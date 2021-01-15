(function(window) 
{
    'use strict';
    class Autopilot
    {
        constructor( cockpit )
        {
            console.log('Autopilot Plugin running');

            var self = this;
            self.cockpit = cockpit;

            self.route = [];
            self.isHUDVisible = false;
            self.isHUDLoaded = false;

            self.settings = null;     // These get sent by the local model

            //Set up actions associated with this plugin
            this.actions = 
            {
                "plugin.autopilot.toggleMenu":
                {
                    description: "Toggle the menu for route planning",
                    controls:
                    {
                        button:
                        {
                            down: function() {
                                self.toggleMenu();
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
                    "alt+2": { type: "button",
                               action: "plugin.autopilot.toggleMenu"}
                }
            };

            //Gets called when alt+2 is pressed
            this.toggleMenu = function(){
                this.cockpit.emit( 'plugin.autopilot.toggleMenu' );
            }

            // Adds a new instruction to the route
            this.addInstruction = function(){
                var listItem = document.createElement('li');
                listItem.style.marginTop = '5px'
                var itemSelect = document.createElement('select');
                itemSelect.setAttribute('name','instr');
                //Creates all the options for movement
                var selectOption1 = document.createElement('option');
                selectOption1.setAttribute('value','frw');
                selectOption1.textContent = 'Forward';
                var selectOption2 = document.createElement('option');
                selectOption2.setAttribute('value','left');
                selectOption2.textContent = 'Left';
                var selectOption3 = document.createElement('option');
                selectOption3.setAttribute('value','right');
                selectOption3.textContent = 'Right';
                var selectOption4 = document.createElement('option');
                selectOption4.setAttribute('value','ascend');
                selectOption4.textContent = 'Ascend';
                var selectOption5 = document.createElement('option');
                selectOption5.setAttribute('value','descend');
                selectOption5.textContent = 'Descend';

                var value = document.createElement('input');
                value.setAttribute('type','text');
                value.setAttribute('name','value');

                itemSelect.appendChild(selectOption1);
                itemSelect.appendChild(selectOption2);
                itemSelect.appendChild(selectOption3);
                itemSelect.appendChild(selectOption4);
                itemSelect.appendChild(selectOption5);
                listItem.appendChild(itemSelect);
                listItem.appendChild(value);
                
                var list = document.getElementById('route');
                list.appendChild(listItem);
            }

            // Sends a message to the ROV to abort the mission
            this.abortRoute = function(){
                self.cockpit.rov.emit('plugin.autopilot.abort');
                var tasks = document.getElementById("route").getElementsByTagName('li');
                Array.from(tasks).forEach(element => {
                    element.style.backgroundColor = 'rgba(255,0,0,0.98)';
                });
            }

            //Replaces all the instruction in the HUD with a single new one
            this.clearInstructions = function(){
                self.abortRoute();
                var tasks = document.getElementById("route").getElementsByTagName('li');
                Array.from(tasks).forEach(element => {
                    element.remove();
                });
                self.addInstruction();
            }

            //Sets the style of the HUD
            this.setStyle = function(tag, list, abort){
                tag.style.width = '40vw';
                tag.style.height = '25vh';
                tag.style.position = 'fixed';
                tag.style.backgroundColor = 'rgba(0,0,0,0.98)';
                tag.style.left = '30vw';
                tag.style.bottom = '1vh';
                tag.style.borderStyle = 'solid';
                tag.style.borderColor = 'white';
                tag.style.padding = '1vh';

                list.style.overflowY = 'scroll';
                list.style.height = '18vh';

                abort.style.color = 'red';
            }

            // Injects all the HTML needed for the HUD
            this.injectHUD = function(self){
                var tag = document.createElement("div");
                tag.setAttribute("id","routeContainer");

                var list = document.createElement('ol');
                list.setAttribute('id','route');
                
                var start = document.createElement('input');
                start.setAttribute('type','button');
                start.setAttribute('name','start');
                start.setAttribute('value','Start');

                //Adds callback that sends the instructions(tasks) to the rov
                start.addEventListener("click", function(){
                    var instructions = [];
                    var route = document.getElementById('route');
                    var listItems = route.getElementsByTagName("li");
                    Array.from(listItems).forEach(listItem => {
                        listItem.style.backgroundColor = 'rgba(0,0,0,0)';
                        var selected = listItem.getElementsByTagName('select')[0].value;
                        var val = listItem.getElementsByTagName('input')[0].value;
                        var instruction = { type:selected, value:val };
                        instructions.push(instruction);
                    });
                    self.cockpit.rov.emit('plugin.autopilot.start',instructions);
                });

                var add = document.createElement('input');
                add.setAttribute('type','button');
                add.setAttribute('name','add');
                add.setAttribute('value','Add');
                add.addEventListener("click", self.addInstruction);

                var clear = document.createElement('input');
                clear.setAttribute('type','button');
                clear.setAttribute('name','clear');
                clear.setAttribute('value','Clear');
                clear.addEventListener("click", self.clearInstructions);

                var abort = document.createElement('input');
                abort.setAttribute('type','button');
                abort.setAttribute('name','abort');
                abort.setAttribute('value','Abort');
                abort.addEventListener("click", self.abortRoute);

                tag.appendChild(list);
                tag.appendChild(add);
                tag.appendChild(clear);
                tag.appendChild(abort);
                tag.appendChild(start);
                document.getElementById('mainContent').appendChild(tag);

                self.addInstruction();
                self.setStyle(tag, list, abort);
            }

        }

        // This pattern will hook events in the cockpit and pull them all back
        // so that the reference to this instance is available for further processing
        listen() 
        {
            var self = this;

            // Listen for settings from the node plugin
            this.cockpit.rov.withHistory.on('plugin.autopilot.settingsChange', function(settings)
            {
                // Copy settings
                self.settings = settings;
                // Re-emit on cockpit
                self.cockpit.emit( 'plugin.autopilot.settingsChange', settings );
            });

            // Listen for response messages from the Node plugin
            this.cockpit.rov.withHistory.on('plugin.autopilot.message', function( message )
            {
                // Log the message!
                console.log( "Autopilot Plugin says: " + message );
                // Rebroadcast for other plugins and widgets in the browser
                self.cockpit.emit( 'plugin.autopilot.message', message );
            });

            // Updates the task status in the UI upon receiving it from the ROV
            this.cockpit.rov.withHistory.on('plugin.autopilot.task-state', function( taskState, taskId )
            {
                console.log( "Task " + taskId + " " + taskState);

                var route = document.getElementById("route");
                if(taskState == "running"){
                    route.getElementsByTagName('li')[taskId].style.backgroundColor = 'rgba(255,255,0,0.98)';
                }else if(taskState == "completed"){
                    route.getElementsByTagName('li')[taskId].style.backgroundColor = 'rgba(0,255,0,0.98)';
                }else{
                    console.log("Specified task state not supported");
                }
                
            });

            // When alt+2 is pressed toggles the HUD
            this.cockpit.on('plugin.autopilot.toggleMenu', function()
            {
                var hud = document.getElementById('routeContainer');
                
                //Adds the HTML if not already present in the DOM
                if(hud === null){
                    self.injectHUD(self);
                    hud = document.getElementById('routeContainer');
                    self.isHUDVisible = false;
                }
                
                //Toggles the HUD visibility
                if( self.isHUDVisible === false){
                    hud.style.display = 'block';
                    self.isHUDVisible = true; 
                }else{
                    hud.style.display = 'none';
                    self.isHUDVisible = false;   
                }

                console.log("HUD Toggled");
            });
        };
    };

    // Add plugin to the window object and add it to the plugins list
    var plugins = namespace('plugins');
    plugins.Autopilot = Autopilot;
    window.Cockpit.plugins.push( plugins.Autopilot );

}(window));
