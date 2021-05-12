(function(window) 
{
    'use strict';
    class ObjectRecognition
    {
        constructor( cockpit )
        {
            console.log('Object Recognition Plugin running');

            var self = this;

            self.cockpit = cockpit;
            self.enabled = false; 
            self.MOCK_VIDEO_TYPE = null;        

            //Set up actions associated with this plugin
            this.actions = 
            {
                "plugin.objectRecognition.toggleObjRecognition":
                {
                    description: "Toggles the object recognition service",
                    controls:
                    {
                        button:
                        {
                            down: function() {
                                self.toggleObjRecognition();
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
                               action: "plugin.objectRecognition.toggleObjRecognition"}
                }
            };

            this.toggleObjRecognition = function(){
                var id = setInterval(function(){
                    if(self.MOCK_VIDEO_TYPE != null){
                        self.cockpit.emit("plugin.objectRecognition.toggleObjRecognition");
                        clearInterval(id);
                    }
                },1000);        
            };

            this.sendFrame = function(canvas, vd_container, video){
                var context = canvas.getContext('2d');
         
                if(self.MOCK_VIDEO_TYPE == "GEOMUX"){
                    context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, canvas.width, (video.videoHeight * canvas.width)/video.videoWidth );
                }else if(self.MOCK_VIDEO_TYPE == "MJPEG"){
                    context.drawImage(video, 0, 0,canvas.width, canvas.height);
                }

                var dataURL = canvas.toDataURL("image/jpeg");

                var img = document.createElement('img');
                img.setAttribute('src', dataURL);
                document.getElementById('routeContainer').appendChild(img);
                
                var imgData = {
                    data:dataURL
                };
                const xhr = new XMLHttpRequest();
                xhr.open("POST","http://192.168.1.103:3000");
                xhr.send(JSON.stringify(imgData));
                console.log("Frame Inviato");
                
                xhr.onload = ()=>{
                    let bd_box = JSON.parse(xhr.response).box;
                    
                    var box_canvas = document.getElementById('camera1').shadowRoot.getElementById('camera1').shadowRoot.getElementById("bdbox");
                    if (box_canvas==null){
                        box_canvas = document.createElement("CANVAS");
                        box_canvas.setAttribute("id","bdbox");
                        box_canvas.style.height = "100%";
                        box_canvas.style.width = "100%";
                        box_canvas.style.position="absolute";  
                        box_canvas.height = vd_container.offsetHeight;
                        box_canvas.width = vd_container.offsetWidth;
                        vd_container.insertBefore(box_canvas, vd_container.firstChild);
                    }

                    var ctx = box_canvas.getContext("2d");
                    ctx.clearRect( 0, 0, canvas.width, canvas.height );
                    ctx.beginPath();
                    ctx.lineWidth = "6"
                    ctx.strokeStyle = "red";
                    ctx.rect( bd_box.x-(bd_box.w/2), bd_box.y-(bd_box.h/2), bd_box.w, bd_box.h );
                    ctx.stroke();
                    
                    console.log(bd_box);
		            self.sendFrame(canvas, vd_container, video);
                };
            };


            this.stopObjRecognition = function(){
                console.log("Stopping Object Recognition");
            };

            this.startObjRecognition = function(){
                var vd_container = document.getElementById('camera1').shadowRoot.getElementById('camera1').shadowRoot.getElementById("videocontainer");
                var video = null;

                if(self.MOCK_VIDEO_TYPE == "GEOMUX"){
                    video = document.getElementById('camera1').shadowRoot.getElementById('camera1').shadowRoot.getElementById('video');
                }else if(self.MOCK_VIDEO_TYPE == "MJPEG"){
                    video = document.getElementById('camera1').shadowRoot.getElementById('camera1').shadowRoot.getElementById('camera1');
                }

                if(video != null){
                    var canvas = document.createElement("canvas");
                    canvas.width = video.offsetWidth;
                    canvas.height = video.offsetHeight;

                    self.sendFrame(canvas, vd_container, video);
                    /*setInterval( function(){self.sendFrame(canvas, vd_container, video);}, 60000 );        */  
                }
                 
            };
        };

        listen() 
        {
            var self = this;
            
            this.cockpit.on('plugin.objectRecognition.toggleObjRecognition', function()
            {
                console.log(self.enabled);
                if(self.enabled==false){
                    self.startObjRecognition();
                }else{
                    self.stopObjRecognition();
                }
            });

            this.cockpit.rov.on('plugin.objectRecognition.video-type', function(vid_tp)
            {
                self.MOCK_VIDEO_TYPE = vid_tp;
            });
        };
    };

    // Add plugin to the window object and add it to the plugins list
    var plugins = namespace('plugins');
    plugins.ObjectRecognition = ObjectRecognition;
    window.Cockpit.plugins.push( plugins.ObjectRecognition );

}(window));
