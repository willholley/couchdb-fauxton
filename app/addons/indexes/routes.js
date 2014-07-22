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
  "addons/databases/base",
  "addons/indexes/views",
  "addons/documents/views",
  "addons/indexes/resources"
],

function (app, FauxtonAPI, Databases, Views, Documents, Resources) {

  var ViewIndexes = FauxtonAPI.RouteObject.extend({
    layout: "two_pane",
    routes: {
      "database/:database/_design/:ddoc/_view/:view": {
        route: "viewFn",
        roles: ['_admin']
      },
      "database/:database/new_view": "newViewEditor",
      "database/:database/new_view/:designDoc": "newViewEditor"
    },
    initialize: function (route, masterLayout, options) {
      this.databaseName = options[0];

      this.data = {
        database: new Databases.Model({id:this.databaseName})
      };

      this.data.designDocs = new Documents.AllDocs(null, {
        database: this.data.database,
        paging: {
          pageSize: 500
        },
        params: {
          startkey: '_design',
          endkey: '_design1',
          include_docs: true,
          limit: 500
        }
      });
    },


    createViewDocumentsView: function (options) {

      return this.setView("#right-content", new Documents.Views.AllDocsList({
        database: options.database,
        collection: options.indexedDocs,
        nestedView: Documents.Views.Row,
        viewList: true,
        ddocInfo: this.ddocInfo(options.designDoc, options.designDocs, options.view),
        docParams: options.docParams,
        params: options.urlParams
      }));
    },

    ddocInfo: function (designDoc, designDocs, view) {
      return {
        id: "_design/" + designDoc,
        currView: view,
        designDocs: designDocs
      };
    },

    createParams: function (options) {
      var urlParams = app.getParams(options);
      var params = Documents.QueryParams.parse(urlParams);

      return {
        urlParams: urlParams,
        docParams: _.extend(params, {limit: this.getDocPerPageLimit(params, 20)})
      };
    },

    getDocPerPageLimit: function (urlParams, perPage) {
      var storedPerPage = perPage;

      if (window.localStorage) {
        storedPerPage = window.localStorage.getItem('fauxton:perpage');

        if (!storedPerPage) {
          this.setDocPerPageLimit(perPage);
          storedPerPage = perPage;
        } else {
          storedPerPage = parseInt(storedPerPage, 10);
        }
      }

      if (!urlParams.limit || urlParams.limit > storedPerPage) {
        return parseInt(storedPerPage, 10);
      } else {
        return parseInt(urlParams.limit, 10);
      }
    },

    establish: function () {
      return this.data.designDocs.fetch({reset: true});
    },

    newViewEditor: function (database, designDoc) {
      var params = app.getParams();

      this.toolsView && this.toolsView.remove();
      this.documentsView && this.documentsView.remove();

      this.viewEditor = this.setView("#left-content", new Views.ViewEditor({
        currentddoc: "_design/"+designDoc || "",
        ddocs: this.data.designDocs,
        params: params,
        database: this.data.database,
        newView: true
      }));

      this.sidebar.setSelectedTab('new-view');
      this.crumbs = function () {
        return [
          {"name": this.data.database.id, "link": Databases.databaseUrl(this.data.database)},
        ];
      };
    },

    viewFn: function (databaseName, ddoc, view) {
      var params = this.createParams(),
          urlParams = params.urlParams,
          docParams = params.docParams,
          decodeDdoc = decodeURIComponent(ddoc);

      view = view.replace(/\?.*$/,'');

      this.data.indexedDocs = new Documents.IndexCollection(null, {
        database: this.data.database,
        design: decodeDdoc,
        view: view,
        params: docParams,
        paging: {
          pageSize: this.getDocPerPageLimit(urlParams, parseInt(docParams.limit, 10))
        }
      });

      this.viewEditor = this.setView("#left-content", new Views.ViewEditor({
        model: this.data.database,
        ddocs: this.data.designDocs,
        viewName: view,
        params: urlParams,
        newView: false,
        database: this.data.database,
        ddocInfo: this.ddocInfo(decodeDdoc, this.data.designDocs, view)
      }));

      this.toolsView && this.toolsView.remove();

      this.documentsView = this.createViewDocumentsView({
        designDoc: decodeDdoc,
        docParams: docParams,
        urlParams: urlParams,
        database: this.data.database,
        indexedDocs: this.data.indexedDocs,
        designDocs: this.data.designDocs,
        view: view
      });


      this.crumbs = function () {
        return [
          {"name": this.data.database.id, "link": Databases.databaseUrl(this.data.database)},
        ];
      };

      this.apiUrl = [this.data.indexedDocs.urlRef("apiurl", urlParams), "docs"];
    }
  });

  // var FilterIndexes = FauxtonAPI.RouteObject.extend({
  //   routes: {
  //     "database/:database/_design/:ddoc/_filters/:fn": {
  //       route: "tempFn",
  //       roles: ['_admin']
  //     },
  //     "database/:database/new_filter": "newFilterEditor",
  //     "database/:database/new_filter/:designDoc": "newFilterEditor"
  //   },
  //   newFilterEditor: function(){
  //     return false;
  //   },
  //   tempFn:  function(databaseName, ddoc, fn){
  //     this.setView("#dashboard-upper-content", new Documents.Views.temp({}));
  //     this.crumbs = function () {
  //       return [
  //         {"name": this.data.database.id, "link": Databases.databaseUrl(this.data.database)},
  //       ];
  //     };
  //   }
  // });

  // var ShowIndexes = FauxtonAPI.RouteObject.extend({
  //   routes: {
  //     "database/:database/_design/:ddoc/_show/:fn": {
  //       route: "tempFn",
  //       roles: ['_admin']
  //     },
  //     "database/:database/new_show": "newShowEditor",
  //     "database/:database/new_show/:designDoc": "newShowEditor"
  //   },
  //   newShowEditor: function(){
  //     return false;
  //   },
  //   tempFn:  function(databaseName, ddoc, fn){
  //     this.setView("#dashboard-upper-content", new Documents.Views.temp({}));
  //     this.crumbs = function () {
  //       return [
  //         {"name": this.data.database.id, "link": Databases.databaseUrl(this.data.database)},
  //       ];
  //     };
  //   }
  // });

  // var ListIndexes = FauxtonAPI.RouteObject.extend({
  //   routes: {
  //     "database/:database/_design/:ddoc/_lists/:fn": {
  //       route: "tempFn",
  //       roles: ['_admin']
  //     },
  //     "database/:database/new_lists": "newListsEditor",
  //     "database/:database/new_lists/:designDoc": "newListsEditor"
  //   },
  //   newListsEditor: function(){
  //     return false;
  //   },
  //   tempFn:  function(databaseName, ddoc, fn){
  //     this.setView("#dashboard-upper-content", new Documents.Views.temp({}));
  //     this.crumbs = function () {
  //       return [
  //         {"name": this.data.database.id, "link": Databases.databaseUrl(this.data.database)},
  //       ];
  //     };
  //   }
  // });

  Views.RouteObjects = [ViewIndexes];

  // Resources.RouteObjects = [ViewIndexes, FilterIndexes, ShowIndexes, ListIndexes];

  return Views;
});
