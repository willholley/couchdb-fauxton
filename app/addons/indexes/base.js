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


/*  View Indexes  */
define([
  "app",
  "api",
  "addons/indexes/views",
  "addons/indexes/routes"
],
function(app, FauxtonAPI, Views, Routes) {
  Routes.initialize = function() {

    /*
      Example of an extension:
      An extension is just an event that may or may not have listener in another view.
      In this case the listener is in the documents addon in the sidebar.

      If there are is a view that you want rendered in another route, this is the way to do it.

      Each Secondary index is going to trigger this event with the views it's passing.
      The views will be rendered and have links to the routes defined in this addon. Then it's just business as usual.

      FauxtonAPI.registerExtension('sidebar:list', new Views.IndexMenu({}));
      FauxtonAPI.registerExtension('sidebar:links',{
        title: "New View",
        url: "new_view"
      });


    */
  };
  return Routes;
});
