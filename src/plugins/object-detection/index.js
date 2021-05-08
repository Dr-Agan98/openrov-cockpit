(function() 
{
    const Listener = require( 'Listener' );

    class ObjectDetection
    {
        constructor(name, deps)
        {
            deps.logger.debug( 'Object Detection plugin loaded!' );
        }
    }

    module.exports = function(name, deps) 
    {
        return new ObjectDetection(name, deps);
    };
}());