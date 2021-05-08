(function(window) 
{
    'use strict';
    class ObjectDetection 
    {
        constructor( cockpit )
        {
            console.log('Object Detection Plugin running');

            var self = this;
            self.cockpit = cockpit;

            self.settings = null; 

            //Set up actions associated with this plugin
            this.actions = 
            {
                "plugin.objectDetection.toggleObjDetection":
                {
                    description: "Toggles the object detection service",
                    controls:
                    {
                        button:
                        {
                            down: function() {
                                self.toggleObjDetection();
                            }
                        }
                    }
                }
            };

            // Setup input handlers
            this.inputDefaults =
            {
                keyboard:
                {
                    "alt+3": { type: "button",
                               action: "plugin.objectDetection.toggleObjDetection"}
                }
            };

            this.toggleObjDetection = function(){
                this.cockpit.emit("plugin.objectDetection.toggleObjDetection");       
            };
        };

        listen() 
        {
            this.cockpit.on('plugin.objectDetection.toggleObjDetection', function()
            {
                var vd_container = document.getElementById('camera1').shadowRoot.getElementById('camera1').shadowRoot.getElementById("videocontainer");
                var video = document.getElementById('camera1').shadowRoot.getElementById('camera1').shadowRoot.getElementById('camera1');
                console.log(video);
                var canvas = document.createElement("canvas");
                canvas.width = video.offsetWidth;
                canvas.height = video.offsetHeight;
                var context = canvas.getContext('2d');
                context.drawImage(video, 0, 0);
                var dataURL = canvas.toDataURL();

                /*var img = document.createElement('img');
                img.setAttribute('src', dataURL);
                document.getElementById('routeContainer').appendChild(img);*/
                
                var imgData = {
                    data:dataURL
                };
                const xhr = new XMLHttpRequest();
                xhr.open("POST","http://127.0.0.1:3000");
                xhr.send(JSON.stringify(imgData));
                
                xhr.onload = ()=>{
                    let bd_box = JSON.parse(xhr.response).box;
                    
                    var box_canvas = document.createElement("CANVAS");
                    box_canvas.setAttribute("id","bdbox");
                    box_canvas.style.height = "100%";
                    box_canvas.style.width = "100%";
                    box_canvas.style.position="absolute";  
                    box_canvas.height = vd_container.offsetHeight;
                    box_canvas.width = vd_container.offsetWidth;
                    vd_container.insertBefore(box_canvas, vd_container.firstChild);
                    
                    var ctx = box_canvas.getContext("2d");
                    ctx.beginPath();
                    ctx.lineWidth = "6"
                    ctx.strokeStyle = "red";
                    ctx.rect(bd_box.x-(bd_box.w/2), bd_box.y-(bd_box.h/2), bd_box.w, bd_box.h);
                    ctx.stroke();
                    
                    console.log(bd_box);
                };
            });
        };
    };

    // Add plugin to the window object and add it to the plugins list
    var plugins = namespace('plugins');
    plugins.ObjectDetection = ObjectDetection;
    window.Cockpit.plugins.push( plugins.ObjectDetection );

}(window));
