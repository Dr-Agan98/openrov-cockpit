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
            this.currentTaskIndex = -1;
            this.timersId = { 'interval':[], 'timeout':[] };
            this.navigationData = {};
            this.depthHoldState = {enabled:false, targetDepth: null};
            this.headingHoldState = {enabled:false, targetHeading: null};

            var self = this;

            /**
             * Sends the correct movement commands to the ROV, based on the input received
             * @param  {Object} instr Contains the instruction type and value(meters,degrees etc.)
             */
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

            /**
             * Maps a value from a range to another range
             * @param  {Number} num     The number to map
             * @param  {Number} in_min  Smallest value of the first range
             * @param  {Number} in_max  Biggest value of the first range
             * @param  {Number} out_min Smallest value of the second range
             * @param  {Number} out_max Biggest value of the second range
             * @return {Number}         The mapped value
             */
            this.mapRange = function(num, in_min, in_max, out_min, out_max){
              return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
            }

            /**
             * If there are instructions available it executes the next one. It also alerts the client that a task has started.
             * Otherwise it resets the task index.
             */
            this.nextInstruction = function(){
              if(self.instructions.length > 0){
                self.currentTaskIndex += 1;
                self.cockpitBus.emit('plugin.autopilot.task-state', 'running', self.currentTaskIndex);
                var instr = self.instructions.pop();
                self.parseInstruction(instr);      
              }else{
                self.currentTaskIndex = -1;
              }
            }

            /**
             * Converts the distance to move in the time it would take at a certain speed
             * @method
             * @param  {Number} distance The distance the rov has to move forward, expressed in meters
             * @return {Number}          The time (in milliseconds) it would take to move that much at the speed specified in the settings
             */
            this.distanceToTime = function(distance){
              return (distance / self.settings.rov_current_speed) * 1000;
            }

            /**
             * Enable/Disable the ROV depth stabilization at the current depth
             * @param  {Boolean} value true if you want to enable; false otherwise 
             */
            this.setDepthHold = function(value){
              self.cockpitBus.emit('plugin.rovpilot.depthHold.set', {enabled:value, targetDepth: self.navigationData.depth });
            }

            /**
             * Enable/Disable the ROV heading stabilization at the current heading
             * @param  {Boolean} value true if you want to enable; false otherwise 
             */
            this.setHeadingHold = function(value){
              self.cockpitBus.emit('plugin.rovpilot.headingHold.set', {enabled:value, targetHeading: self.navigationData.heading });
            }

            /**
             * Controls if the ROV is moving in the correct trajectory
             * @return {Boolean} true if is moving well; false if it needs to be stabilized
             */
            this.isFollowingDirection = function(){
              var _heading = self.mapRange(self.navigationData.heading, -180,180, 0,360);
              var _target_heading = self.mapRange(self.headingHoldState.targetHeading, -180,180, 0,360);
              var _depth = self.navigationData.depth;
              var _target_depth = self.depthHoldState.targetDepth * 100;
              return (_target_heading - self.settings.heading_error < _heading &&
                      _target_heading + self.settings.heading_error > _heading  &&
                      _target_depth - self.settings.depth_error < _depth &&
                      _target_depth + self.settings.depth_error > _depth)
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
                
                //Starts the route by executing the first instruction
                start: new Listener( self.cockpitBus, 'plugin.autopilot.start', false, function(instructionList)
                {
                    // For some reason if the depth hold is enabled when its already enabled it sets the hold target at 0 meters
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

                //Stores the navigation data continuously
                navigationData: new Listener( self.cockpitBus,'plugin.navigationData.data', false, function(navdata)
                {               
                  self.navigationData = navdata;
                }),

                //Stores the depth hold state every time a change is made to it
                depthHoldState: new Listener( self.cockpitBus, 'plugin.rovpilot.depthHold.state', false, function(state)
                {
                  self.depthHoldState = state;
                }),

                //Stores the heading hold state every time a change is made to it
                headingHoldState: new Listener( self.cockpitBus, 'plugin.rovpilot.headingHold.state', false, function(state)
                {
                  self.headingHoldState = state;
                }),

                //Moves forward for the specified distance in meters
                forward: new Listener( self.cockpitBus,'plugin.autopilot.forward', false, function(distance)
                {
                  var initialTime = Date.now();

                  var idInterval = setInterval(function(){
                    self.cockpitBus.emit('plugin.autopilot.checkDistance', initialTime, distance, self.settings.checking_interval, idInterval);
                  }, self.settings.checking_interval); 

                  //Stores the timer id in an array
                  self.timersId.interval.push(idInterval);
                }),

                //Rotates left for the specified number of degrees
                left: new Listener( self.cockpitBus,'plugin.autopilot.left', false, function(degrees)
                {
                  var startHeading = self.navigationData.heading;

                  var idInterval = setInterval(function(){
                    self.cockpitBus.emit('plugin.autopilot.checkDegrees', startHeading, degrees, idInterval);
                  }, self.settings.checking_interval);    

                  self.timersId.interval.push(idInterval);  
                  self.setHeadingHold(false);
                  self.cockpitBus.emit('plugin.rovpilot.rates.setYaw', -1);          
                }),

                //Rotates right for the specified number of degrees
                right: new Listener( self.cockpitBus,'plugin.autopilot.right', false, function(degrees)
                {
                  var startHeading = self.navigationData.heading;

                  var idInterval = setInterval(function(){
                    self.cockpitBus.emit('plugin.autopilot.checkDegrees', startHeading, degrees, idInterval);
                  }, self.settings.checking_interval);   

                  self.timersId.interval.push(idInterval);        
                  self.setHeadingHold(false);      
                  self.cockpitBus.emit('plugin.rovpilot.rates.setYaw', 1);
                }),

                //Moves upward for the specified distance in meters
                ascend: new Listener( self.cockpitBus,'plugin.autopilot.ascend', false, function(metersToAscend)
                {
                  var startDepth = self.navigationData.depth;

                  var idInterval = setInterval(function(){
                    self.cockpitBus.emit('plugin.autopilot.checkDepth', startDepth, metersToAscend, idInterval);
                  }, self.settings.checking_interval);   

                  self.timersId.interval.push(idInterval);  
                  self.setDepthHold(false);            
                  self.cockpitBus.emit('plugin.rovpilot.rates.setLift', 1);
                }),

                //Moves downward for the specified distance in meters
                descend: new Listener( self.cockpitBus,'plugin.autopilot.descend', false, function(metersToDescend)
                {
                  var startDepth = self.navigationData.depth;

                  var idInterval = setInterval(function(){
                    self.cockpitBus.emit('plugin.autopilot.checkDepth', startDepth, metersToDescend, idInterval);
                  }, self.settings.checking_interval); 

                  self.timersId.interval.push(idInterval);     
                  self.setDepthHold(false);     
                  self.cockpitBus.emit('plugin.rovpilot.rates.setLift', -1);        
                  
                }),

                //Stops the ROV if it has already turned the specified degrees
                checkDegrees: new Listener( self.cockpitBus,'plugin.autopilot.checkDegrees', false, function(start, degrees, idInterval)
                {
                  var heading = self.navigationData.heading;
                  var degreesTurned = Math.abs(start - heading);
                  //TODO: Set acceptable error during turning
                  if(degreesTurned >= (degrees*0.96)){
                    self.cockpitBus.emit('plugin.rovpilot.allStop');
                    self.cockpitBus.emit('plugin.autopilot.task-state', 'completed', self.currentTaskIndex);
                    clearInterval(idInterval);
                    self.setHeadingHold( true );

                    var idTimeout = setTimeout(function(){
                      self.nextInstruction();
                    }, self.settings.stabilization_time);

                    self.timersId.timeout.push(idTimeout);   
                  } 
                }),

                //Stops the ROV if it has already moved upwards/downwards the specified meters
                checkDepth: new Listener( self.cockpitBus,'plugin.autopilot.checkDepth', false, function(initialDepth, meters, idInterval)
                {
                  var currentDepth = self.navigationData.depth;
                  var metersMoved = Math.abs(initialDepth - currentDepth);
                  //TODO: Set acceptable error during ascent/descent
                  if(metersMoved >= (meters*0.96)){
                    self.cockpitBus.emit('plugin.rovpilot.allStop');
                    self.cockpitBus.emit('plugin.autopilot.task-state', 'completed', self.currentTaskIndex);
                    clearInterval(idInterval);
                    self.setDepthHold(true);

                    var idTimeout = setTimeout(function(){
                      self.nextInstruction();
                    }, self.settings.stabilization_time);

                    self.timersId.timeout.push(idTimeout); 
                  } 
                }),

                //Stops the ROV if it has already moved forward the specified meters
                //If the ROV starts going off trajectory it stops it and starts the stabilization process
                checkDistance: new Listener( self.cockpitBus,'plugin.autopilot.checkDistance', false, function(initialTime, meters, timeOffset, idInterval)
                {
                  var currentTime = Date.now();
                  var timeElapsed = (currentTime - initialTime) - timeOffset;
                  //TODO: Set acceptable error during forward moving
                  if(timeElapsed >= (self.distanceToTime(meters) * 0.96)){
                    self.cockpitBus.emit('plugin.rovpilot.allStop');
                    console.log("Completed");
                    self.cockpitBus.emit('plugin.autopilot.task-state', 'completed', self.currentTaskIndex);
                    clearInterval(idInterval);

                    var idTimeout = setTimeout(function(){
                      self.nextInstruction();  
                    }, self.settings.stabilization_time);

                    self.timersId.timeout.push(idTimeout); 

                  }else if(!self.isFollowingDirection()){
                      clearInterval(idInterval);
                      self.cockpitBus.emit('plugin.rovpilot.allStop');

                      var idTimeout = setTimeout(function(){

                        var newIdInterval = setInterval(function(){
                          self.cockpitBus.emit('plugin.autopilot.checkDistance', initialTime, meters, timeOffset + self.settings.stabilization_time + self.settings.checking_interval, newIdInterval);
                        }, self.settings.checking_interval); 

                        self.timersId.interval.push(newIdInterval);               
                      }, self.settings.stabilization_time); 

                      self.timersId.timeout.push(idTimeout); 
                  }else{
                    self.cockpitBus.emit('plugin.rovpilot.rates.setThrottle', 1); 
                  }
                }),

                //Stops all movement and resets all the instructions
                abort: new Listener( self.cockpitBus,'plugin.autopilot.abort', false, function()
                {
                  setImmediate(function(){
                    self.instructions = [];
                    self.currentTaskIndex = -1;
                    self.cockpitBus.emit('plugin.rovpilot.allStop');
                    while(self.timersId.interval.length > 0){
                      clearInterval(self.timersId.interval.pop());
                    }
                    while(self.timersId.timeout.length > 0){
                      clearInterval(self.timersId.timeout.pop());
                    }
                  });
                  
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
                  'rov_current_speed': {
                    'description': "The speed in m/s the rov can reach with the current power level",
                    'type': 'integer',
                    'default': 2.2
                  },
                  'heading_error':{
                    'description': "The acceptable deviation of the current heading from the target in degrees",
                    'type': 'integer',
                    'default': 10
                  },
                  'depth_error':{
                    'description': "The acceptable deviation of the current depth from the target in meters",
                    'type': 'integer',
                    'default': 5
                  },
                  'checking_interval':{
                    'description': "The delay before the ROV checks again its movement status in milliseconds",
                    'type': 'integer',
                    'default': 100
                  },
                  'stabilization_time':{
                    'description': "The time the ROV takes to stabilize when of trajectory in milliseconds",
                    'type': 'integer',
                    'default': 3000
                  }
                },
                'required': [
                  'rov_current_speed',
                  'heading_error',
                  'depth_error',
                  'checking_interval',
                  'stabilization_time'
                ]
            }];
        }

    }

    module.exports = function(name, deps) 
    {
        return new Autopilot(name, deps);
    };
}());