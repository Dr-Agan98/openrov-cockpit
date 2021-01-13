(function() 
{
    const Listener = require( 'Listener' );

    class Autopilot
    {
        constructor(name, deps)
        {
            deps.logger.debug( 'Autopilot plugin loaded!' );

            this.globalBus  = deps.globalEventLoop;   // This is the server-side messaging bus. The MCU sends messages to server plugins over this
            this.cockpitBus = deps.cockpit;           // This is the server<->client messaging bus. This is how the server talks to the browser

            this.settings = {};
            this.instructions = [];
            this.navigationData = {};
            this.depthHoldState = {enabled:false, targetDepth: null};
            this.headingHoldState = {enabled:false, targetHeading: null};

            var self = this;

            this.parseInstruction = function(instr){
              var type = instr.type;
              switch(type){
                case "frw":
                  self.cockpitBus.emit('plugin.autopilot.forward', instr.value);
                  break;
                case "left":
                  self.cockpitBus.emit('plugin.autopilot.left' , instr.value);
                  break;
                case "right":
                  self.cockpitBus.emit('plugin.autopilot.right' , instr.value);
                  break;
                case "ascend":
                  self.cockpitBus.emit('plugin.autopilot.ascend', instr.value);
                  break;
                case "descend":
                  self.cockpitBus.emit('plugin.autopilot.descend', instr.value);
                  break;
                default:
                  break;
              }
            }

            this.mapRange = function(num, in_min, in_max, out_min, out_max){
              return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
            }

            this.nextInstruction = function(){
              if(self.instructions.length > 0){
                var instr = self.instructions.pop();
                self.parseInstruction(instr);      
              }
            }

            this.distanceToTime = function(distance){
              //TODO: set speed with settings
              return (distance/2)*1000;
            }

            this.setDepthHold = function(value){
              self.cockpitBus.emit('plugin.rovpilot.depthHold.set', {enabled:value, targetDepth: self.navigationData.depth });
            }

            this.setHeadingHold = function(value){
              self.cockpitBus.emit('plugin.rovpilot.headingHold.set', {enabled:value, targetHeading: self.navigationData.heading });
            }

            this.isFollowingDirection = function(){
              //TODO: set acceptable deviation through settings
              var _heading = self.mapRange(self.navigationData.heading, -180,180, 0,360);
              var _target_heading = self.mapRange(self.headingHoldState.targetHeading, -180,180, 0,360);
              var _depth = self.navigationData.depth;
              var _target_depth = self.depthHoldState.targetDepth * 100;
              return (_target_heading - 10 < _heading &&
                      _target_heading + 10 > _heading  &&
                      _target_depth - 5 < _depth &&
                      _target_depth + 5 > _depth)
            }

            // Pre-define all of the event listeners here. We defer enabling them until later.
            // Look at src/libs/Listener.js to see how these work.
            this.listeners = 
            {

                // Listener for Settings updates
                settings: new Listener( self.globalBus, 'settings-change.autopilot', true, function( settings )
                {
                    // Apply settings
                    self.settings = settings.autopilot;

                    // Emit settings update to cockpit
                    self.cockpitBus.emit( 'plugin.autopilot.settingsChange', self.settings );
                }),
                
                start: new Listener( self.cockpitBus, 'plugin.autopilot.start', false, function(instructionList)
                {
                    self.setDepthHold( false );
                    self.setDepthHold( true );
                    self.setHeadingHold( true );

                    self.instructions = [];
                    instructionList.forEach( function(item){
                      self.instructions.push(item);
                    });
                    self.instructions = self.instructions.reverse();
                    self.nextInstruction();
                }),

                navigationData: new Listener( self.cockpitBus,'plugin.navigationData.data', false, function(navdata)
                {               
                  self.navigationData = navdata;
                }),

                depthHoldState: new Listener( self.cockpitBus, 'plugin.rovpilot.depthHold.state', false, function(state)
                {
                  self.depthHoldState = state;
                }),

                headingHoldState: new Listener( self.cockpitBus, 'plugin.rovpilot.headingHold.state', false, function(state)
                {
                  self.headingHoldState = state;
                }),

                forward: new Listener( self.cockpitBus,'plugin.autopilot.forward', false, function(distance)
                {
                  var initialTime = Date.now();
                  //TODO: add id to global list
                  var idInterval = setInterval(function(){
                    //TODO: set delays from settings
                    self.cockpitBus.emit('plugin.autopilot.checkDistance', initialTime, distance, 0, idInterval);
                  }, 100); 
                }),

                left: new Listener( self.cockpitBus,'plugin.autopilot.left', false, function(degrees)
                {
                  var startHeading = self.navigationData.heading;
                  //TODO: add id to global list
                  var idInterval = setInterval(function(){
                    //TODO: set delays from settings
                    self.cockpitBus.emit('plugin.autopilot.checkDegrees', startHeading, degrees, idInterval);
                  }, 100);      
                  self.setHeadingHold(false);
                  self.cockpitBus.emit('plugin.rovpilot.rates.setYaw', -1);          
                }),

                right: new Listener( self.cockpitBus,'plugin.autopilot.right', false, function(degrees)
                {
                  var startHeading = self.navigationData.heading;
                  //TODO: add id to global list
                  var idInterval = setInterval(function(){
                    //TODO: set delays from settings
                    self.cockpitBus.emit('plugin.autopilot.checkDegrees', startHeading, degrees, idInterval);
                  }, 100);           
                  self.setHeadingHold(false);      
                  self.cockpitBus.emit('plugin.rovpilot.rates.setYaw', 1);
                }),

                ascend: new Listener( self.cockpitBus,'plugin.autopilot.ascend', false, function(metersToAscend)
                {
                  var startDepth = self.navigationData.depth;
                  //TODO: add id to global list
                  var idInterval = setInterval(function(){
                    //TODO: set delays from settings
                    self.cockpitBus.emit('plugin.autopilot.checkDepth', startDepth, metersToAscend, idInterval);
                  }, 100);     
                  self.setDepthHold(false);            
                  self.cockpitBus.emit('plugin.rovpilot.rates.setLift', 1);
                }),

                descend: new Listener( self.cockpitBus,'plugin.autopilot.descend', false, function(metersToDescend)
                {
                  var startDepth = self.navigationData.depth;
                  //TODO: add id to global list
                  var idInterval = setInterval(function(){
                    //TODO: set delays from settings
                    self.cockpitBus.emit('plugin.autopilot.checkDepth', startDepth, metersToDescend, idInterval);
                  }, 100);      
                  self.setDepthHold(false);     
                  self.cockpitBus.emit('plugin.rovpilot.rates.setLift', -1);        
                  
                }),

                checkDegrees: new Listener( self.cockpitBus,'plugin.autopilot.checkDegrees', false, function(start, degrees, idInterval)
                {
                  var heading = self.navigationData.heading;
                  var degreesTurned = Math.abs(start - heading);
                  //TODO: Set acceptable error during turning
                  if(degreesTurned >= (degrees*0.96)){
                    self.cockpitBus.emit('plugin.rovpilot.allStop');
                    clearInterval(idInterval);
                    self.setHeadingHold( true );
                    //TODO: add id to global list??
                    setTimeout(function(){
                      self.nextInstruction();  
                    }, 3000);
                  } 
                }),

                checkDepth: new Listener( self.cockpitBus,'plugin.autopilot.checkDepth', false, function(initialDepth, meters, idInterval)
                {
                  var currentDepth = self.navigationData.depth;
                  var metersMoved = Math.abs(initialDepth - currentDepth);
                  //TODO: Set acceptable error during ascent/descent
                  if(metersMoved >= (meters*0.96)){
                    self.cockpitBus.emit('plugin.rovpilot.allStop');
                    clearInterval(idInterval);
                    self.setDepthHold(true);
                    //TODO: add id to global list??
                    setTimeout(function(){
                      self.nextInstruction();  
                    }, 3000);
                  } 
                }),

                checkDistance: new Listener( self.cockpitBus,'plugin.autopilot.checkDistance', false, function(initialTime, meters, timeOffset, idInterval)
                {
                  var currentTime = Date.now();
                  var timeElapsed = (currentTime - initialTime) - timeOffset;
                  //TODO: Set acceptable error during ascent/descent
                  if(timeElapsed >= (self.distanceToTime(meters) * 0.96)){
                    self.cockpitBus.emit('plugin.rovpilot.allStop');
                    clearInterval(idInterval);
                    setTimeout(function(){
                      self.nextInstruction();  
                    }, 3000);
                  }else if(!self.isFollowingDirection()){
                      clearInterval(idInterval);
                      self.cockpitBus.emit('plugin.rovpilot.allStop');
                      setTimeout(function(){
                        var newIdInterval = setInterval(function(){
                          //TODO: Set offset from settings
                          self.cockpitBus.emit('plugin.autopilot.checkDistance', initialTime, meters, timeOffset + 1000, newIdInterval);
                        }, 100);  
                        //TODO: Set delay from settings              
                      }, 1000); 
                  }else{
                    self.cockpitBus.emit('plugin.rovpilot.rates.setThrottle', 1); 
                  }
                }),


                abort: new Listener( self.cockpitBus,'plugin.autopilot.abort', false, function()
                {
                  self.instructions = [];
                  self.cockpitBus.emit('plugin.rovpilot.allStop');
                })
            }
        }
        
        // This is automatically called when cockpit loads all of the plugins, and when a plugin is enabled
        start()
        {
          // Enable the listeners!
          this.listeners.settings.enable();
          this.listeners.start.enable();
          this.listeners.depthHoldState.enable();
          this.listeners.headingHoldState.enable();
          this.listeners.navigationData.enable();
          this.listeners.forward.enable();
          this.listeners.left.enable();
          this.listeners.right.enable();
          this.listeners.ascend.enable();
          this.listeners.descend.enable();
          this.listeners.checkDegrees.enable();
          this.listeners.checkDepth.enable();
          this.listeners.checkDistance.enable();
          this.listeners.abort.enable();
        }

        // This is called when the plugin is disabled
        stop()
        {
          // Disable listeners
          this.listeners.settings.disable();
          this.listeners.start.disable();
          this.listeners.depthHoldState.disable();
          this.listeners.headingHoldState.enable();
          this.listeners.navigationData.disable();
          this.listeners.forward.disable();
          this.listeners.left.disable();
          this.listeners.right.disable();
          this.listeners.ascend.disable();
          this.listeners.descend.disable();
          this.listeners.checkDegrees.disable();
          this.listeners.checkDepth.disable();
          this.listeners.checkDistance.disable();
          this.listeners.abort.disable();
        }

        getSettingSchema()
        {
            //from http://json-schema.org/examples.html
            return [{
                'title': 'Autopilot Plugin',
                'type': 'object',
                'id': 'autopilot',
                'properties': {
                  'Time for Stabilization': {
                    'description': "Duration in milliseconds",
                    'type': 'integer',
                    'default': 3000
                  },
                  'lastName': {
                    'type': 'string',
                    'default': 'Rov'
                  }
                },
                'required': [
                  
                ]
            }];
        }

    }

    module.exports = function(name, deps) 
    {
        return new Autopilot(name, deps);
    };
}());