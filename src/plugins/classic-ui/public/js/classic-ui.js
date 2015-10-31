(function (window, $) {
  'use strict';
  if (window.openrovtheme!=='classic-ui') return;
  var plugins = namespace('plugins');

  plugins.classicUi = function ClassicUI() {

    var jsFileLocation = urlOfJsFile('standard.js');

    this.name = 'classic-ui';   // for the settings
    this.viewName = 'Classic UI'; // for the UI

    this.template = '<rov-ui-standard id="UIContainer"></rov-ui-standard>';

    this.loaded = function() {
    };
    this.disable = function () {
    };

  };

  plugins.classicUi.prototype.listen = function listen(){
    $('#t')[0]['cockpit-event-emitter'] = this.cockpit;

    window.cockpit_int.i18n.loadNamespace('classic-ui', function() {  });
    var key_s = window.cockpit_int.i18n.options.keyseparator;
    var ns_s =  window.cockpit_int.i18n.options.nsseparator;
    var prefix = 'new-ui';
    $('#t')[0]['__']=function(str){
      window.cockpit_int.i18n.options.ns.defaultNs = prefix
      return window.cockpit_int.__(str);
    };

  }
  window.Cockpit.UIs.push(plugins.classicUi);
}(window, jQuery));
