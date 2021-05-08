(function() 
{
    const Listener = require( 'Listener' );

    class ObjectRecognition
    {
        constructor(name, deps)
        {
            deps.logger.debug( 'Object Recognition plugin loaded!' );
        }
    }

    module.exports = function(name, deps) 
    {
        return new ObjectRecognition(name, deps);
    };
}());