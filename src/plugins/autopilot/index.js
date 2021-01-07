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

            this.instructions = [];
            this.navigationData = {};

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

            this.nextInstruction = function(){
              if(self.instructions.length > 0){
                var instr = self.instructions.pop();
                self.parseInstruction(instr);      
              }
            }

            this.distanceToTime = function(distance){
              return (distance/2)*1000;
            }

            // Pre-define all of the event listeners here. We defer enabling them until later.
            // Look at src/libs/Listener.js to see how these work.
            this.listeners = 
            {
                start: new Listener( self.cockpitBus, 'plugin.autopilot.start', false, function(instructionList)
                {
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

                forward: new Listener( self.cockpitBus,'plugin.autopilot.forward', false, function(distance)
                {
                  self.cockpitBus.emit('plugin.rovpilot.rates.setThrottle', 1);
                  setTimeout(function(){
                    self.cockpitBus.emit('plugin.rovpilot.allStop');
                    self.nextInstruction();
                  }, self.distanceToTime(distance) );
                }),

                left: new Listener( self.cockpitBus,'plugin.autopilot.left', false, function(degrees)
                {
                  var startHeading = self.navigationData.heading;
                  var idInterval = setInterval(function(){
                    self.cockpitBus.emit('plugin.autopilot.checkDegrees', startHeading, degrees, idInterval);
                  }, 100);      
                  self.cockpitBus.emit('plugin.rovpilot.rates.setYaw', -1);          
                }),

                right: new Listener( self.cockpitBus,'plugin.autopilot.right', false, function(degrees)
                {
                  var startHeading = self.navigationData.heading;
                  var idInterval = setInterval(function(){
                    self.cockpitBus.emit('plugin.autopilot.checkDegrees', startHeading, degrees, idInterval);
                  }, 100);                 
                  self.cockpitBus.emit('plugin.rovpilot.rates.setYaw', 1);
                }),

                ascend: new Listener( self.cockpitBus,'plugin.autopilot.ascend', false, function(metersToAscend)
                {
                  var startDepth = self.navigationData.depth;
                  var idInterval = setInterval(function(){
                    self.cockpitBus.emit('plugin.autopilot.checkDepth', startDepth, metersToAscend, idInterval);
                  }, 100);                 
                  self.cockpitBus.emit('plugin.rovpilot.rates.setLift', 1);
                }),

                descend: new Listener( self.cockpitBus,'plugin.autopilot.descend', false, function(metersToDescend)
                {
                  var startDepth = self.navigationData.depth;
                  var idInterval = setInterval(function(){
                    self.cockpitBus.emit('plugin.autopilot.checkDepth', startDepth, metersToDescend, idInterval);
                  }, 100);        
                  self.cockpitBus.emit('plugin.rovpilot.rates.setLift', -1);        
                  
                }),

                checkDegrees: new Listener( self.cockpitBus,'plugin.autopilot.checkDegrees', false, function(start, degrees, idInterval)
                {
                  var heading = self.navigationData.heading;
                  var degreesTurned = Math.abs(start - heading);
                  console.log(degreesTurned);
                  if(degreesTurned >= (degrees*0.96)){
                    self.cockpitBus.emit('plugin.rovpilot.allStop');
                    clearInterval(idInterval);
                    self.nextInstruction();  
                  } 
                }),

                checkDepth: new Listener( self.cockpitBus,'plugin.autopilot.checkDepth', false, function(initialDepth, meters, idInterval)
                {
                  var currentDepth = self.navigationData.depth;
                  var metersMoved = Math.abs(initialDepth - currentDepth);
                  console.log(metersMoved);
                  if(metersMoved >= (meters*0.96)){
                    self.cockpitBus.emit('plugin.rovpilot.allStop');
                    clearInterval(idInterval);
                    self.nextInstruction();  
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
          this.listeners.start.enable();
          this.listeners.navigationData.enable();
          this.listeners.forward.enable();
          this.listeners.left.enable();
          this.listeners.right.enable();
          this.listeners.ascend.enable();
          this.listeners.descend.enable();
          this.listeners.checkDegrees.enable();
          this.listeners.checkDepth.enable();
          this.listeners.abort.enable();
        }

        // This is called when the plugin is disabled
        stop()
        {
          // Disable listeners
          this.listeners.start.disable();
          this.listeners.navigationData.disable();
          this.listeners.forward.disable();
          this.listeners.left.disable();
          this.listeners.right.disable();
          this.listeners.ascend.disable();
          this.listeners.descend.disable();
          this.listeners.checkDegrees.disable();
          this.listeners.checkDepth.disable();
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
                  'firstName': {
                    'type': 'string',
                    'default': 'Open'
                  },
                  'lastName': {
                    'type': 'string',
                    'default': 'Rov'
                  },
                  'age': {
                    'description': 'Age in years',
                    'type': 'integer',
                    'minimum': 0
                  }
                },
                'required': [
                  'firstName',
                  'lastName'
                ]
            }];
        }

    }

    module.exports = function(name, deps) 
    {
        return new Autopilot(name, deps);
    };
}());