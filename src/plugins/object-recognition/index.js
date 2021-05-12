(function() 
{
    const Listener = require( 'Listener' );

    class ObjectRecognition
    {
        constructor(name, deps)
        {
            deps.logger.debug( 'Object Recognition plugin loaded!' );
            this.cockpitBus = deps.cockpit;
            this.videoType = process.env.MOCK_VIDEO_TYPE;

            var self = this;

            setInterval(function(){
                self.cockpitBus.emit( 'plugin.objectRecognition.video-type', self.videoType );
            }, 3000);

            this.listeners = 
            {
                videoType: new Listener( self.cockpitBus, 'plugin.objectRecognition.get-video-type', true, function()
                {
                    self.cockpitBus.emit( 'plugin.objectRecognition.video-type', self.videoType );
                })
            };
        }

        start(){
            // Enable the listeners!
            this.listeners.videoType.enable();
        }

        // This is called when the plugin is disabled
        stop(){
            // Disable listeners
            this.listeners.videoType.disable();
        }
    }

    module.exports = function(name, deps) 
    {
        return new ObjectRecognition(name, deps);
    };
}());