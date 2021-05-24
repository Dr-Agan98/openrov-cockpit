(function (window) {
    'use strict';
    class ObjectRecognition {
        constructor(cockpit) {
            console.log('Object Recognition Plugin running');

            var self = this;

            self.xhr = new XMLHttpRequest();
            self.cockpit = cockpit;
            self.enabled = false;
            self.MOCK_VIDEO_TYPE = null;
            self.socket = null;

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
                                down: function () {
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
                        "alt+3": {
                            type: "button",
                            action: "plugin.objectRecognition.toggleObjRecognition"
                        }
                    }
                };

            this.toggleObjRecognition = function () {
                var id = setInterval(function () {
                    if (self.MOCK_VIDEO_TYPE != null) {
                        self.cockpit.emit("plugin.objectRecognition.toggleObjRecognition");
                        clearInterval(id);
                    }
                }, 1000);
            };

            this.sendFrame = function (canvas_copy) {
                var video = self.getVideoContainer();

                if (video != null) {

                    if (self.socket == null) {
                        $.getScript("https://cdn.socket.io/3.1.3/socket.io.min.js", function(){
                            self.socket = io("http://192.168.1.103:5000/");
                            
                            self.socket.on('connect', function () {
                                console.log("CONNECTED");

                                setInterval(function(){
                                    video.style.objectPosition = 'top';
                                    canvas_copy.width = video.offsetWidth;
                                    canvas_copy.height = video.offsetHeight;

                                    var context = canvas_copy.getContext('2d');

                                    if (self.MOCK_VIDEO_TYPE == "GEOMUX") {
                                        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, canvas_copy.width, (video.videoHeight * canvas_copy.width) / video.videoWidth);
                                    } else if (self.MOCK_VIDEO_TYPE == "MJPEG") {
                                        context.drawImage(video, 0, 0, canvas_copy.width, canvas_copy.height);
                                    }

                                    var imgData = {
                                        data: canvas_copy.toDataURL("image/jpeg")
                                    };
                                    self.socket.emit('test', JSON.stringify(imgData));
                                    console.log("Frame Inviato");
                                },200);
        
                            });

                            self.socket.on('detection', function(response){
                                console.log(response);
				let resp = JSON.parse(response);
                                let bd_box = resp.box;
                                var box_canvas = document.getElementById('camera1').shadowRoot.getElementById('camera1').shadowRoot.getElementById("bdbox");
                                if (box_canvas == null){
                                    box_canvas = document.createElement("CANVAS");
                                    box_canvas.setAttribute("id","bdbox");
                                    box_canvas.style.height = "100%";
                                    box_canvas.style.width = "100%";
                                    box_canvas.style.position = "absolute";  
                                    video.insertAdjacentElement('beforebegin', box_canvas);
				    setInterval(function(){
				    	var ctx = box_canvas.getContext("2d");
                			ctx.clearRect(0, 0, canvas_copy.height, canvas_copy.width);
				    },1000);
                                }
                                
                                box_canvas.height = canvas_copy.height;
                                box_canvas.width = canvas_copy.width;
        
                                if(resp.confidence>0.5) self.drawBdBox(box_canvas, bd_box);
                            });
                        });
                    }

                } else {
                    console.log("ERR::Couldn't find video container");
                }

            };

            this.drawBdBox = function (box_canvas, bd_box) {
                var ctx = box_canvas.getContext("2d");
                ctx.clearRect(0, 0, box_canvas.width, box_canvas.height);

                if (bd_box != null) {
                    ctx.beginPath();
                    ctx.lineWidth = "1"
                    ctx.strokeStyle = "green";
                    ctx.rect(bd_box.x - (bd_box.w / 2), bd_box.y - (bd_box.h / 2), bd_box.w, bd_box.h);
                    ctx.stroke();
                }
            };

            this.getVideoContainer = function () {
                if (self.MOCK_VIDEO_TYPE == "GEOMUX") {
                    return document.getElementById('camera1').shadowRoot.getElementById('camera1').shadowRoot.getElementById('video');
                } else if (self.MOCK_VIDEO_TYPE == "MJPEG") {
                    return document.getElementById('camera1').shadowRoot.getElementById('camera1').shadowRoot.getElementById('camera1');
                } else {
                    return null;
                }
            };

            this.stopObjRecognition = function () {
                console.log("Stopping Object Recognition...");
                self.enabled = false;
                console.log("Stopped Object Recognition");
            };

            this.startObjRecognition = function () {
                console.log("Starting Object Recognition...");
                self.enabled = true;
                var canvas_copy = document.createElement("canvas");
                self.sendFrame(canvas_copy);
                console.log("Started Object Recognition");
            };
        };

        listen() {
            var self = this;

            this.cockpit.on('plugin.objectRecognition.toggleObjRecognition', function () {
                /*var socketio = document.createElement('script');  
                socketio.setAttribute('src','https://cdn.socket.io/3.1.3/socket.io.min.js');
                socketio.setAttribute('integrity', "sha384-cPwlPLvBTa3sKAgddT6krw0cJat7egBga3DJepJyrLl4Q9/5WLra3rrnMcyTyOnh");
                socketio.setAttribute('crossorigin', "anonymous");
                document.head.appendChild(socketio);*/
                if (self.enabled == false) {
                    self.startObjRecognition();
                } else {
                    self.stopObjRecognition();
                }
            });

            this.cockpit.rov.on('plugin.objectRecognition.video-type', function (vid_tp) {
                self.MOCK_VIDEO_TYPE = vid_tp;
            });
        };
    };

    // Add plugin to the window object and add it to the plugins list
    var plugins = namespace('plugins');
    plugins.ObjectRecognition = ObjectRecognition;
    window.Cockpit.plugins.push(plugins.ObjectRecognition);

}(window));
