// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License. You may obtain a copy of
// the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations under
// the License.
define([
        "app",
        "api",
        "addons/fauxton/components",
        "addons/documents/resources",
        "addons/databases/base",
        "addons/pouchdb/base",
        "plugins/beautify"
],

function (app, FauxtonAPI, Components, Documents, Databases, pouchdb, beautify) {
  var Views = {};


  Views.AdvancedOptions = FauxtonAPI.View.extend({
    template: "addons/documents/templates/advanced_options",
    className: "advanced-options well",

    initialize: function (options) {
      this.database = options.database;
      this.ddocName = options.ddocName;
      this.viewName = options.viewName;
      this.updateViewFn = options.updateViewFn;
      this.previewFn = options.previewFn;
      this.showStale = _.isUndefined(options.showStale) ? false : options.showStale;
      this.hasReduce = _.isUndefined(options.hasReduce) ? true : options.hasReduce;
    },

    events: {
      "change form.js-view-query-update input": "updateFilters",
      "change form.js-view-query-update select": "updateFilters",
      "submit form.js-view-query-update": "updateView",
      "click .toggle-btns > label":  "toggleQuery"
    },

    toggleQuery: function(e){
      e.preventDefault();

      if (this.$(e.currentTarget).hasClass("active")){
        this.$('.js-query-keys-wrapper').addClass("hide");
        this.$(".toggle-btns > label").removeClass('active');
        this.$('.js-query-keys-wrapper').find("input,textarea").attr("disabled","true");
      } else {
        this.$('.js-query-keys-wrapper').removeClass("hide");
        var showFunctionName =this.$(e.currentTarget).attr("for");
        //highlight current
        this.$(".toggle-btns > label").removeClass('active');
        this.$(e.currentTarget).addClass("active");
        this.$("[id^='js-show']").hide();
        //show section & disable what needs to be disabled
        this[showFunctionName]();
      }
    },

    showKeys: function(){
      this.$("#js-showKeys, .js-disabled-message").show();
      this.$('[name="startkey"],[name="endkey"],[name="inclusive_end"]').attr("disabled","true");
      this.$('[name="keys"]').removeAttr("disabled");
    },

    showStartEnd: function(){
      this.$("#js-showStartEnd").show();
      this.$('[name="startkey"],[name="endkey"],[name="inclusive_end"]').removeAttr("disabled");
      this.$('.js-disabled-message').hide();
      this.$('[name="keys"]').attr("disabled","true");
    },

    beforeRender: function () {
      if (this.viewName && this.ddocName) {
        var buttonViews = FauxtonAPI.getExtensions('advancedOptions:ViewButton');
        _.each(buttonViews, function (view) {
          this.insertView('#button-options', view);
          view.update(this.database, this.ddocName, this.viewName);
        }, this);
      }
    },

    renderOnUpdatehasReduce: function (hasReduce) {
      this.hasReduce = hasReduce;
      this.render();
    },

    parseJSON: function (value) {
      try {
        return JSON.parse(value);
      } catch(e) {
        return undefined;
      }
    },

    validateKeys:  function(param){
      var errorMsg = false,
          parsedValue = this.parseJSON(param.value);

      if (_.isUndefined(parsedValue)) {
        errorMsg = "Keys must be valid json.";
      } else if (!_.isArray(parsedValue)) {
        errorMsg =  "Keys values must be in an array. E.g [1,2,3]";
      }

      if (errorMsg) {
        this.$('.js-keys-error').empty();
        FauxtonAPI.addNotification({
          type: "error",
          msg: errorMsg,
          clear:  false,
          selector: '.advanced-options .errors-container'
        });
        return false;
      }

      return true;
    },
    validateFields: function(params){
      var errors = false;
      //so ghetto. Spaghetti code.
      for (var i= 0; i <params.length; i++){
        if (params[i].name === "skip"){
          if (!(/^\d+$/).test(params[i].value)){
            FauxtonAPI.addNotification({
              msg: "Numbers only for skip",
              type: "warn",
              selector: ".advanced-options .errors-container",
              clear:  true
            });
            errors = true;
          }
        }
      }
      return errors;
    },
    queryParams: function () {
      var $form = this.$(".js-view-query-update"),
          keysParam = false;

      var params = _.reduce($form.serializeArray(), function(params, param) {
        if (!param.value) { return params; }
        if (param.name === "limit" && param.value === 'None') { return params; }
        if (param.name === "keys") { keysParam = param; }
        params.push(param);
        return params;
      }, []);


      if (keysParam && !this.validateKeys(keysParam)) { return false; }

      if (params && this.validateFields(params)){ return false; }

      // Validate *key* params to ensure they're valid JSON
      var keyParams = ["keys","startkey","endkey"];
      var errorParams = _.filter(params, function(param) {
        if (_.contains(keyParams, param.name) && _.isUndefined(this.parseJSON(param.value))) {
            return true;
          }

          return false;
      }, this);

      return {params: params, errorParams: errorParams};
    },

    updateView: function (event) {
      event.preventDefault();
      var params = this.queryParams();
      if (!params) { return;}
      this.updateViewFn(event, params);
    },

    updateFilters: function(event) {
      event.preventDefault();
      var $ele = $(event.currentTarget);
      var name = $ele.attr('name');
      this.updateFiltersFor(name, $ele);
    },

    updateFiltersFor: function(name, $ele) {
      var $form = $ele.parents("form.js-view-query-update:first");
      switch (name) {
        // Reduce constraints
        //   - Can't include_docs for reduce=true
        //   - can't include group_level for reduce=false
        case "reduce":
          if ($ele.prop('checked') === true) {
          if ($form.find("input[name=include_docs]").prop("checked") === true) {
            $form.find("input[name=include_docs]").prop("checked", false);
            var notification = FauxtonAPI.addNotification({
              msg: "include_docs has been disabled as you cannot include docs on a reduced view",
              type: "warn",
              selector: ".advanced-options .errors-container",
              clear:  true
            });
          }
          $form.find("input[name=include_docs]").prop("disabled", true);
          $form.find("select[name=group_level]").prop("disabled", false);
        } else {
          $form.find("select[name=group_level]").val("999").prop("disabled", true);
          $form.find("input[name=include_docs]").prop("disabled", false);
        }
        break;
        case "skip":
          if (!(/^\d+$/).test($ele.val())){
            FauxtonAPI.addNotification({
              msg: "Numbers only for skip",
              type: "warn",
              selector: ".advanced-options .errors-container",
              clear:  true
            });
          }
        break;
        case "include_docs":
        break;
      }
    },

    updateFromParams: function (params) {
      var $form = this.$el.find("form.js-view-query-update");
      _.each(params, function(val, key) {
        var $ele;
        switch (key) {
          case "limit":
          case "descending":
          case "group_level":
            if (!val) { return; }
            $form.find("select[name='"+key+"']").val(val);
          break;
          case "include_docs":
            case "stale":
            case "inclusive_end":
            $form.find("input[name='"+key+"']").prop('checked', true);
          break;
          case "reduce":
            $ele = $form.find("input[name='"+key+"']");
          if (val == "true") {
            $ele.prop('checked', true);
          }
          this.updateFiltersFor(key, $ele);
          break;
          case "key":
          case "keys":
            $form.find("textarea[name='"+key+"']").val(val);
          break;
          default:
            $form.find("input[name='"+key+"']").val(val);
          break;
        }
      }, this);
    },

    serialize: function () {
      return {
        hasReduce: this.hasReduce,
        showPreview: false,
        showStale: this.showStale
      };
    }
  });


   Views.DesignDocSelector = FauxtonAPI.View.extend({
    template: "addons/documents/templates/design_doc_selector",

    events: {
      "change select#ddoc": "updateDesignDoc"
    },

    initialize: function (options) {
      this.ddocName = options.ddocName;
      this.database = options.database;
      this.listenTo(this.collection, 'add', this.ddocAdded);
      this.DocModel = options.DocModel || Documents.Doc;
    },

    ddocAdded: function (ddoc) {
      this.ddocName = ddoc.id;
      this.render();
    },

    serialize: function () {
      return {
        ddocName: this.ddocName,
        ddocs: this.collection
      };
    },

    updateDesignDoc: function () {
      if (this.newDesignDoc()) {
        this.$('#new-ddoc-section').show();
      } else {
        this.$('#new-ddoc-section').hide();
      }
    },

    newDesignDoc: function () {

      return this.$('#ddoc').val() === 'new-doc';
    },

    newDocValidation: function(){
      return this.newDesignDoc() && this.$('#new-ddoc').val()==="";
    },
    getCurrentDesignDoc: function () {
      if (this.newDesignDoc()) {
        var doc = {
          _id: '_design/' + this.$('#new-ddoc').val(),
          views: {},
          language: "javascript"
        };
        var ddoc = new this.DocModel(doc, {database: this.database});
        //this.collection.add(ddoc);
        return ddoc;
      } else if ( !this.newDesignDoc() ) {
        var ddocName = this.$('#ddoc').val();
        return this.collection.find(function (ddoc) {
          return ddoc.id === ddocName;
        }).dDocModel();
      }
    }
  });



  Views.ViewEditor = FauxtonAPI.View.extend({
    template: "addons/documents/templates/view_editor",
    builtinReduces: ['_sum', '_count', '_stats'],

    events: {
      "click button.save": "saveView",
      "click button.delete": "deleteView",
      "change select#reduce-function-selector": "updateReduce",
      "click button.preview": "previewView",
      "click #db-views-tabs-nav": 'toggleIndexNav',
      "click .beautify_map":  "beautifyCode",
      "click .beautify_reduce":  "beautifyCode",
      "click #query-options-wrapper": 'toggleIndexNav'
    },

    langTemplates: {
      "javascript": {
        map: "function(doc) {\n  emit(doc._id, 1);\n}",
        reduce: "function(keys, values, rereduce){\n  if (rereduce){\n    return sum(values);\n  } else {\n    return values.length;\n  }\n}"
      }
    },

    defaultLang: "javascript",

    initialize: function(options) {
      this.newView = options.newView || false;
      this.ddocs = options.ddocs;
      this.params = options.params;
      this.database = options.database;
      this.currentDdoc = options.currentddoc;
      if (this.newView) {
        this.viewName = 'newView';
      } else {
        this.ddocID = options.ddocInfo.id;
        this.viewName = options.viewName;
        this.ddocInfo = new Documents.DdocInfo({_id: this.ddocID},{database: this.database});
      }

      this.showIndex = false;
      _.bindAll(this);
    },

    establish: function () {
      if (this.ddocInfo) {
        return this.ddocInfo.fetch();
      }
    },

    updateValues: function() {
      var notification;
      if (this.model.changedAttributes()) {
        notification = FauxtonAPI.addNotification({
          msg: "Document saved successfully.",
          type: "success",
          clear: true
        });
        this.editor.setValue(this.model.prettyJSON());
      }
    },

    updateReduce: function(event) {
      var $ele = $("#reduce-function-selector");
      var $reduceContainer = $(".control-group.reduce-function");
      if ($ele.val() == "CUSTOM") {
        this.createReduceEditor();
        this.reduceEditor.setValue(this.langTemplates.javascript.reduce);
        $reduceContainer.show();
      } else {
        $reduceContainer.hide();
      }
    },

    deleteView: function (event) {
      event.preventDefault();

      if (this.newView) { return alert('Cannot delete a new view.'); }
      if (!confirm('Are you sure you want to delete this view?')) {return;}

      var that = this,
          promise,
          viewName = this.$('#index-name').val(),
          ddocName = this.$('#ddoc :selected').val(),
          ddoc = this.getCurrentDesignDoc();

      ddoc.removeDdocView(viewName);

      if (ddoc.hasViews()) {
        promise = ddoc.save();
      } else {
        promise = ddoc.destroy();
      }

      promise.then(function () {
        FauxtonAPI.navigate('/database/' + that.database.safeID() + '/_all_docs?limit=' + Databases.DocLimit);
        FauxtonAPI.triggerRouteEvent('reloadDesignDocs');
      });
    },

    saveView: function(event) {
      var json, notification,
      that = this;

      if (event) { event.preventDefault();}

      $('#dashboard-content').scrollTop(0); //scroll up

      if (this.hasValidCode() && this.$('#new-ddoc:visible').val() !=="") {
        var mapVal = this.mapEditor.getValue(),
        reduceVal = this.reduceVal(),
        viewName = this.$('#index-name').val(),
        ddoc = this.getCurrentDesignDoc(),
        ddocName = ddoc.id,
        viewNameChange = false;

        if (this.viewName !== viewName) {
          ddoc.removeDdocView(this.viewName);
          this.viewName = viewName;
          viewNameChange = true;
        }

        notification = FauxtonAPI.addNotification({
          msg: "Saving document.",
          selector: "#define-view .errors-container",
          clear: true
        });

        ddoc.setDdocView(viewName, mapVal, reduceVal);

        ddoc.save().then(function () {
          that.ddocs.add(ddoc);

          that.mapEditor.editSaved();
          that.reduceEditor && that.reduceEditor.editSaved();


          FauxtonAPI.addNotification({
            msg: "View has been saved.",
            type: "success",
            selector: "#define-view .errors-container",
            clear: true
          });

          if (that.newView || viewNameChange) {
            var fragment = '/database/' + that.database.safeID() +'/' + ddoc.safeID() + '/_view/' + app.utils.safeURLName(viewName);

            FauxtonAPI.navigate(fragment, {trigger: false});
            that.newView = false;
            that.ddocID = ddoc.safeID();
            that.viewName = viewName;
            that.ddocInfo = ddoc;
            that.showIndex = true;
            that.render();
            FauxtonAPI.triggerRouteEvent('reloadDesignDocs', {
              selectedTab: app.utils.removeSpecialCharacters(ddocName.replace(/_design\//,'')) + '_' + app.utils.removeSpecialCharacters(viewName)
            });
          }

          if (that.reduceFunStr !== reduceVal) {
            that.reduceFunStr = reduceVal;
            that.advancedOptions.renderOnUpdatehasReduce(that.hasReduce());
          }

          FauxtonAPI.triggerRouteEvent('updateAllDocs', {ddoc: ddocName, view: viewName});

        }, function(xhr) {
          var responseText = JSON.parse(xhr.responseText).reason;
          notification = FauxtonAPI.addNotification({
            msg: "Save failed: " + responseText,
            type: "error",
            clear: true
          });
        });
      } else {
        var errormessage = (this.$('#new-ddoc:visible').val() ==="")?"Enter a design doc name":"Please fix the Javascript errors and try again.";
        notification = FauxtonAPI.addNotification({
          msg: errormessage,
          type: "error",
          selector: "#define-view .errors-container",
          clear: true
        });
      }
    },

    updateView: function(event, paramInfo) {
       event.preventDefault();

       if (this.newView) { return alert('Please save this new view before querying it.'); }

       var errorParams = paramInfo.errorParams,
           params = paramInfo.params;

       if (_.any(errorParams)) {
         _.map(errorParams, function(param) {

           // TODO: Where to add this error?
           // bootstrap wants the error on a control-group div, but we're not using that
           //$('form.view-query-update input[name='+param+'], form.view-query-update select[name='+param+']').addClass('error');
           return FauxtonAPI.addNotification({
             msg: "JSON Parse Error on field: "+param.name,
             type: "error",
             selector: ".advanced-options .errors-container",
             clear: true
           });
         });
         FauxtonAPI.addNotification({
           msg: "Make sure that strings are properly quoted and any other values are valid JSON structures",
           type: "warning",
           selector: ".advanced-options .errors-container",
           clear: true
         });

         return false;
      }

       var fragment = window.location.hash.replace(/\?.*$/, '');
       if (!_.isEmpty(params)) {
        fragment = fragment + '?' + $.param(params);
       }

       FauxtonAPI.navigate(fragment, {trigger: false});
       FauxtonAPI.triggerRouteEvent('updateAllDocs', {ddoc: this.ddocID, view: this.viewName});
    },


    previewView: function(event, paramsInfo) {
      event.preventDefault();
      var that = this,
      mapVal = this.mapVal(),
      reduceVal = this.reduceVal(),
      paramsArr = [];

      if (paramsInfo && paramsInfo.params) {
        paramsArr = paramsInfo.params;
      }

      var params = _.reduce(paramsArr, function (params, param) {
        params[param.name] = param.value;
        return params;
      }, {reduce: false});

      FauxtonAPI.addNotification({
        msg: "<strong>Warning!</strong> Preview executes the Map/Reduce functions in your browser, and may behave differently from CouchDB.",
        type: "warning",
        selector: ".advanced-options .errors-container",
        fade: true,
        escape: false // beware of possible XSS when the message changes
      });

      var promise = FauxtonAPI.Deferred();

      if (!this.database.allDocs || this.database.allDocs.params.include_docs !== true) {
        this.database.buildAllDocs({limit: Databases.DocLimit.toString(), include_docs: true});
        promise = this.database.allDocs.fetch();
       } else {
        promise.resolve();
       }

      promise.then(function () {
        params.docs = that.database.allDocs.map(function (model) { return model.get('doc');});
        var queryPromise = pouchdb.runViewQuery({map: mapVal, reduce: reduceVal}, params);
        queryPromise.then(function (results) {
          FauxtonAPI.triggerRouteEvent('updatePreviewDocs', {rows: results.rows, ddoc: that.getCurrentDesignDoc().id, view: that.viewName});
        });
      });
    },

    getCurrentDesignDoc: function () {
      return this.designDocSelector.getCurrentDesignDoc();
    },

    isCustomReduceEnabled: function() {
      return $("#reduce-function-selector").val() == "CUSTOM";
    },

    mapVal: function () {
      if (this.mapEditor) {
        return this.mapEditor.getValue();
      }

      return this.$('#map-function').text();
    },

    reduceVal: function() {
      var reduceOption = this.$('#reduce-function-selector :selected').val(),
      reduceVal = "";

      if (reduceOption === 'CUSTOM') {
        if (!this.reduceEditor) { this.createReduceEditor(); }
        reduceVal = this.reduceEditor.getValue();
      } else if ( reduceOption !== 'NONE') {
        reduceVal = reduceOption;
      }

      return reduceVal;
    },


    hasValidCode: function() {
      return _.every(["mapEditor", "reduceEditor"], function(editorName) {
        var editor = this[editorName];
        if (editorName === "reduceEditor" && ! this.isCustomReduceEnabled()) {
          return true;
        }
        return editor.hadValidCode();
      }, this);
    },

    toggleIndexNav: function (event) {
      $('#dashboard-content').scrollTop(0); //scroll up

      var $targetId = this.$(event.target).attr('id'),
          $previousTab = this.$(this.$('li.active a').attr('href')),
          $targetTab = this.$(this.$(event.target).attr('href'));

      if ($targetTab.attr('id') !== $previousTab.attr('id')) {
        $previousTab.removeAttr('style');
      }

      if ($targetId === 'index-nav') {
        if (this.newView) { return; }
        var that = this;
        $('#dashboard-content').scrollTop(0); //scroll up
        $targetTab.toggle('slow', function(){
           that.showEditors();
        });
      } else {
        $targetTab.toggle('slow');
      }
    },

    serialize: function() {
      return {
        ddocs: this.ddocs,
        ddoc: this.model,
        ddocName: this.model.id,
        viewName: this.viewName,
        reduceFunStr: this.reduceFunStr,
        isCustomReduce: this.hasCustomReduce(),
        newView: this.newView,
        langTemplates: this.langTemplates.javascript
      };
    },

    hasCustomReduce: function() {
      return this.reduceFunStr && ! _.contains(this.builtinReduces, this.reduceFunStr);
    },

    hasReduce: function () {
      return this.reduceFunStr || false;
    },

    createReduceEditor: function () {
      if (this.reduceEditor) {
        this.reduceEditor.remove();
      }

      this.reduceEditor = new Components.Editor({
        editorId: "reduce-function",
        mode: "javascript",
        couchJSHINT: true
      });
      this.reduceEditor.render();

      if (this.reduceEditor.getLines() === 1){
        this.$('.beautify_reduce').removeClass("hide");
        $('.beautify-tooltip').tooltip();
      }
    },
    beforeRender: function () {

      if (this.newView) {
        this.reduceFunStr = '';
        if (this.ddocs.length === 0) {
          this.model = new Documents.Doc(null, {database: this.database});
        } else {
          this.model = this.ddocs.first().dDocModel();
        }
        this.ddocID = this.model.id;
      } else {
        var ddocDecode = decodeURIComponent(this.ddocID);
        this.model = this.ddocs.get(this.ddocID).dDocModel();
        this.reduceFunStr = this.model.viewHasReduce(this.viewName);
      }

      var viewFilters = FauxtonAPI.getExtensions('sidebar:viewFilters'),
          filteredModels = this.ddocs.models,
          designDocs = this.ddocs.clone();

      if (!_.isEmpty(viewFilters)) {
        _.each(viewFilters, function (filter) {
          filteredModels = _.filter(filteredModels, filter);
        });
        designDocs.reset(filteredModels, {silent: true});
      }

      this.designDocSelector = this.setView('.design-doc-group', new Views.DesignDocSelector({
        collection: designDocs,
        ddocName: this.currentDdoc || this.model.id,
        database: this.database
      }));

      if (!this.newView) {
        this.eventer = _.extend({}, Backbone.Events);

        this.advancedOptions = this.insertView('#query', new Views.AdvancedOptions({
          updateViewFn: this.updateView,
          previewFn: this.previewView,
          database: this.database,
          viewName: this.viewName,
          ddocName: this.model.id,
          hasReduce: this.hasReduce(),
          eventer: this.eventer,
          showStale: true
        }));
      }

    },

    afterRender: function() {

      if (this.params && !this.newView) {
        this.advancedOptions.updateFromParams(this.params);
      }

      this.designDocSelector.updateDesignDoc();
      if (this.newView || this.showIndex) {
        this.showEditors();
        this.showIndex = false;
      } else {
        this.$('#index').hide();
        this.$('#index-nav').parent().removeClass('active');
      }

    },

    showEditors: function () {
      this.mapEditor = new Components.Editor({
        editorId: "map-function",
        mode: "javascript",
        couchJSHINT: true
      });
      this.mapEditor.render();

      if (this.hasCustomReduce()) {
        this.createReduceEditor();
      } else {
        $(".control-group.reduce-function").hide();
      }

      if (this.newView) {
        this.mapEditor.setValue(this.langTemplates[this.defaultLang].map);
        //Use a built in view by default
        //this.reduceEditor.setValue(this.langTemplates[this.defaultLang].reduce);
      }

      this.mapEditor.editSaved();
      this.reduceEditor && this.reduceEditor.editSaved();

      if (this.mapEditor.getLines() === 1){
        this.$('.beautify_map').removeClass("hide");
        $('.beautify-tooltip').tooltip();
      }
    },
    beautifyCode: function(e){
      e.preventDefault();
      var targetEditor = $(e.currentTarget).hasClass('beautify_reduce')?this.reduceEditor:this.mapEditor;
      var beautifiedCode = beautify(targetEditor.getValue());
      targetEditor.setValue(beautifiedCode);
    },
    cleanup: function () {
      this.mapEditor && this.mapEditor.remove();
      this.reduceEditor && this.reduceEditor.remove();
    }
  });

  return Views;
});
