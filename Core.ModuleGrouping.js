﻿/*globals Core*/
Core.ModuleGrouping = (function () {

   var moduleGroupings = {},
       runningModuleGroupings = [],
       previewEvents = {},
       restartEvents = {},
       postEvents = {},
       slice = [].slice,
       inArray = function (list, item) {
          var i, arrayLength, found = false;

          for (i = 0, arrayLength = list.length; i < arrayLength && found === false; i++) {
             if (item === list[i]) {
                found = true;
             }
          }
          return found;
       },
       raiseEvents = function (groupingName, events) {
          var i,
             arrayLength,
             grouping = events[groupingName];

          if (grouping === null || grouping === undefined) { }
          else {
             for (i = 0, arrayLength = grouping.length; i < arrayLength; i++) {
                Core.Communication.notify.apply(null, grouping[i]);
             }
          }
       },
       moduleGroupIsRunning = function (groupingName) {
          return inArray(runningModuleGroupings, groupingName);
       },
       startModuleGroup = function (groupingName) {
          var i,
             arrayLength,
             returnValue = false,
             grouping = moduleGroupings[groupingName],
             moduleArguments;

          if (grouping === null || grouping === undefined) {
             throw new Error("Module grouping cannot be started as it has never been registered " + groupingName);
          }
          else {
             if (moduleGroupIsRunning(groupingName) === false) {
                //start any dependant modules
                if (grouping.dependsOnModuleGroupings !== undefined) {
                   for (i = 0, arrayLength = grouping.dependsOnModuleGroupings.length; i < arrayLength; i++) {
                      //recursive call to start module grouping
                      startModuleGroup(grouping.dependsOnModuleGroupings[i]);
                   }
                }

                //let the world know we are loading these modules
                raiseEvents(groupingName, previewEvents);

                if (grouping.startsModules !== undefined) {
                   for (i = 0, arrayLength = grouping.startsModules.length; i < arrayLength; i++) {
                      //register any arguments
                      if (grouping.moduleArguments !== undefined) {
                         moduleArguments = grouping.moduleArguments[grouping.startsModules[i]];
                         if (moduleArguments !== undefined) {
                            moduleArguments = moduleArguments.slice(0, moduleArguments.length);
                            moduleArguments.unshift(grouping.startsModules[i]);
                            Core.registerArguments.apply(null, moduleArguments);
                         }
                      }
                      //start the modules
                      Core.start(grouping.startsModules[i]);
                   }
                }

                //raise the events after the modules have been loaded
                raiseEvents(groupingName, postEvents);
                returnValue = true;

                //add the module grouing to the list of module groupings that are running
                runningModuleGroupings.push(groupingName);
                Core.Communication.notify("ModuleGroupingStarting", groupingName);
             }

             //raise events regardless whether the module was started or not
             raiseEvents(groupingName, restartEvents);
          }

          return returnValue;
       },
       stopModuleGrouping = function (groupingName, stopDependants) {
          var i,
          foundIndex = -1,
          arrayLength,
          returnValue,
          grouping = moduleGroupings[groupingName];

          if (grouping === null || grouping === undefined) {
             returnValue = false;
          }
          else {
             Core.Communication.notify("ModuleGroupingStopping", groupingName);
             if (stopDependants === false) { }
             else {
                //stop any dependant modules
                if (grouping.dependsOnModuleGroupings !== undefined) {
                   for (i = 0, arrayLength = grouping.dependsOnModuleGroupings.length; i < arrayLength; i++) {
                      //recursive call to start module grouping
                      stopModuleGrouping(grouping.dependsOnModuleGroupings[i]);
                   }
                }
             }

             if (grouping.startsModules !== undefined) {
                for (i = 0, arrayLength = grouping.startsModules.length; i < arrayLength; i++) {
                   //stop the modules
                   Core.stop(grouping.startsModules[i]);
                }
             }
             returnValue = true;

             for (i = 0, arrayLength = runningModuleGroupings.length; i < arrayLength && foundIndex === -1; i++) {
                if (runningModuleGroupings[i] === groupingName) {
                   foundIndex = i;
                }
             }

             if (foundIndex !== -1) {
                runningModuleGroupings.splice(foundIndex, 1);
             }
          }
          return returnValue;
       },
       dependencyList = function (groupingName) {
          var i,
          arrayLength,
          subDependencies,
          dependencies = [],
          dependency,
          grouping = moduleGroupings[groupingName];

          if (grouping === null || grouping === undefined) { }
          else if (grouping.dependsOnModuleGroupings === undefined) { }
          else {
             for (i = 0, arrayLength = grouping.dependsOnModuleGroupings.length; i < arrayLength; i++) {
                dependency = grouping.dependsOnModuleGroupings[i];
                dependencies.push(dependency);

                subDependencies = dependencyList(dependency);
                while (subDependencies.length > 0) {
                   dependencies.push(subDependencies.shift());
                }
             }
          }
          return dependencies;
       },
       getAllElementsInArrayNotInSecond = function (first, second) {
          var i, arrayLength, returnValue = [], temp;

          for (i = 0, arrayLength = first.length; i < arrayLength; i++) {
             temp = first[i];
             if (inArray(second, temp) === false) {
                returnValue.push(temp);
             }
          }
          return returnValue;
       },
       stopNonDependantModules = function (stopGroupingName, startGroupingName) {
          var stopDependentModuleGroupings = dependencyList(stopGroupingName),
          startDependentModuleGroupings = dependencyList(startGroupingName),
          moduleGroupingsToStop, i, arrayLength;

          stopDependentModuleGroupings.unshift(stopGroupingName);
          startDependentModuleGroupings.unshift(startGroupingName);

          moduleGroupingsToStop = getAllElementsInArrayNotInSecond(stopDependentModuleGroupings, startDependentModuleGroupings);

          for (i = 0, arrayLength = moduleGroupingsToStop.length; i < arrayLength; i++) {
             stopModuleGrouping(moduleGroupingsToStop[i], false);
          }
       },
       stopModuleGroupingAndStartAnotherGrouping = function (stopGroupingName, startGroupingName) {
          if (stopGroupingName === undefined || stopGroupingName === "") {
             startModuleGroup(startGroupingName);
          }
          else {
             stopNonDependantModules(stopGroupingName, startGroupingName);
             startModuleGroup(startGroupingName);
          }
       },
      registerArguments = function (parameters) {
         if (moduleGroupings[parameters.moduleGroupingName] === undefined) {
            throw new Error("Module grouping cannot have arguments registered against it as it has never been registered " + parameters.moduleGroupingName);
         }
         else if (moduleGroupings[parameters.moduleGroupingName].startsModules.indexOf(parameters.module) === -1) {
            throw new Error("Module grouping " + parameters.moduleGroupingName + " does not have module registered " + parameters.module + " and so cannot have arguments registered against it");
         }
         else {
            if (moduleGroupings[parameters.moduleGroupingName].moduleArguments === undefined) {
               moduleGroupings[parameters.moduleGroupingName].moduleArguments = {};
            }
            moduleGroupings[parameters.moduleGroupingName].moduleArguments[parameters.module] = parameters.arguments;
         }
      };

   return {
      reset: function () {
         moduleGroupings = {};
         runningModuleGroupings = [];
         previewEvents = {};
         postEvents = {};
      },
      isModuleGroupRunning: function (groupingName) {
         var i, arrayLength, found = false;

         for (i = 0, arrayLength = runningModuleGroupings.length; i < arrayLength; i++) {
            if (runningModuleGroupings[i] === groupingName) {
               found = true;
            }
         }
         return found;
      },
      registerGroup: function (data) {
         if (data.name === null || data.name === undefined) {
            throw new Error("Module grouping cannot be registered without a name");
         }
         else {
            moduleGroupings[data.name] = data;
         }
      },
      registerPreviewEvents: function () {
         var groupingName = arguments[0],
             args = slice.call(arguments, 1);

         if (!previewEvents[groupingName]) {
            previewEvents[groupingName] = [];
         }
         previewEvents[groupingName].push(args);
      },
      registerRestartEvents: function () {
         var groupingName = arguments[0],
             args = slice.call(arguments, 1);

         if (!restartEvents[groupingName]) {
            restartEvents[groupingName] = [];
         }
         restartEvents[groupingName].push(args);
      },
      registerPostEvents: function () {
         var groupingName = arguments[0],
             args = slice.call(arguments, 1);

         if (!postEvents[groupingName]) {
            postEvents[groupingName] = [];
         }
         postEvents[groupingName].push(args);
      },
      start: function (groupingName) {
         return startModuleGroup(groupingName);
      },
      stop: function (groupingName) {
         return stopModuleGrouping(groupingName);
      },
      stopModuleGroupingAndStartAnotherGrouping: function (stopGroupingName, startGroupingName) {
         stopModuleGroupingAndStartAnotherGrouping(stopGroupingName, startGroupingName);
      },
      registerArguments: registerArguments
   };
})();