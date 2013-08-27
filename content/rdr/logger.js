
var RedirectRemovertUtils = {};

/**
 *  trim leading and trailing whitespace.
 *  If text is null or undefined or empty, return the original value.
 *  Throw an error if text type is not a string.
 */
RedirectRemovertUtils.trimText = function(text)
{
    if(!text)
    {
        return text;
    }
    if(typeof(text) != "string")
    {
        throw new Error("text required");
    }

    text = text.replace(/^\s+/, '');
    text = text.replace(/\s+$/, '');

    // and replace all conjuncted whitespaces with a single space
    //text = text.replace(/\s+/g, ' ');

    return text;
};

RedirectRemovertUtils.encodeURIComponents = function(data)
{
    if(!data)
        return "";
    
    var pairs = [];
    var regexp = /%20/g; // A regular expression to match an encoded space

    if(data instanceof Array)
    {
        for(var i = 0; i < data.length; i++)
        {
            // Create a name/value pair, but encode name and value first
            // The global function encodeURIComponent does almost what we want,
            // but it encodes spaces as %20 instead of as "+". We have to
            // fix that with String.replace()
            var value = data[i].value;
            if(value == undefined || value == null)
                value = "";
                
            var pair = encodeURIComponent(data[i].name) + "=" + encodeURIComponent(value);
            //var pair = data[i].name +  "=" + data[i].value;
    
            pairs.push(pair);
        }
    }
    else
    {
        for(var name in data)
        {
            if(typeof(data[name]) != "function")
            {
                var value = data[name];
                if(value == undefined || value == null)
                    value = "";
                    
                var pair = encodeURIComponent(name) + "=" + encodeURIComponent(value);
                pairs.push(pair);
            }
        }
    }

    // Concatenate all the name/value pairs, separating them with &
    return pairs.join('&').replace(regexp, "+");
};

RedirectRemovertUtils.defineClass = function(data)
{
    var classname = data.name;
    var superclass = data.extend || Object;
    var constructor = data.construct || function(){};
    var methods = data.methods || {};
    var statics = data.statics || {};

    // create the prototype object that will become prototype for the result class
    var proto = new superclass();

    for(var p in proto)
    {
        // delete any noninherited properties
        if(proto.hasOwnProperty(p))
        {
            delete proto[p];
        }
    }

    // copy instance methods to the prototype object
    for(var p in methods)
    {
        proto[p] = methods[p];
    }

    proto.constructor = constructor;
    proto.superclass = superclass;
    if(classname)
    {
        proto.classname = classname;
    }

    // associate the prototype object with the constructor function
    constructor.prototype = proto;

    // copy static properties to the constructor
    for(var p in statics)
    {
        constructor[p] = statics[p];
    }

    return constructor;
};


RedirectRemovertUtils.createUID = function()
{
    return "" + (new Date()).getTime();
};

RedirectRemovertUtils.copyProperties = function(target, src)
{
    if(!target || !src)
        return;
        
    for(var o in src)
    {
        target[o] = src[o];
    }
};
RedirectRemovertUtils.createXMLHttpRequest = function(data)
{
    var method = data.method || "GET";
    var url = data.url;
    var async = (data.async == undefined ? true : data.async);
    var body = (data.body == undefined ? null : data.body);
    var callback = data.callback;
    var eventName = data.event || "onreadystatechange";
    var mimeType = data.mimeType || "text/xml";

    var httpRequest = new XMLHttpRequest();
    if(!httpRequest)
    {
        throw new Error("Failed to create XMLHttpRequest object.");
    }

    if(httpRequest.overrideMimeType)
    {
        httpRequest.overrideMimeType(mimeType);
    }

    if(callback)
    {
        //httpRequest.onreadystatechange = callback;
        httpRequest.addEventListener(eventName, callback, false);
    }

    if(url)
    {
        httpRequest.open(method, url, async);
        httpRequest.send(body);
    }

    return httpRequest;
};

RedirectRemovertUtils.Logger = RedirectRemovertUtils.defineClass(
{
    name: "Utils.Logger",
    /**
     * @param appInfo: app information. Format for example: {param1: value1, param2: value2 }
     * @param commonData: data that will be sent by default. Format for example: {param1: value1, param2: value2 }
     */     
    construct: function(appInfo, serverUrl, commonData)
        {
            if(serverUrl)
            {
                serverUrl = RedirectRemovertUtils.trimText(serverUrl);
                
                var pos = serverUrl.lastIndexOf("?");
                if(pos == -1)
                {
                    this.urlSuffix = "?";
                }
                else if(pos != serverUrl.length - 1)
                {
                    pos = serverUrl.lastIndexOf("&");
                    if(pos != serverUrl.length - 1)
                    {
                        this.urlSuffix = "&";
                    }
                }
            }
            this.serverUrl = serverUrl;
            this.staticData = {};
            
            RedirectRemovertUtils.copyProperties(this.staticData, appInfo);
            RedirectRemovertUtils.copyProperties(this.staticData, commonData);
        },
        
    methods:
    {
        /**
         * @param: data object with name/value pairs. For example: {param1: value1, param2: value2}
         */
        log: function(data)
        {
            // remove log functionality
            return;
            
            try
            {
                if(!this.serverUrl)
                    return;
                
                var queryString = RedirectRemovertUtils.encodeURIComponents(this.staticData);
                if(queryString)
                    queryString += "&";
                
                var temp = {};
                // chrome will not send out request if two requests have the same url and parameters
                temp["randomfix"] = (new Date()).getTime();
                RedirectRemovertUtils.copyProperties(temp, data);
                queryString += RedirectRemovertUtils.encodeURIComponents(temp);
                
                var url = this.serverUrl;
                if(queryString)
                {
                    url += this.urlSuffix;
                    url += queryString;
                }
                
                RedirectRemovertUtils.createXMLHttpRequest({url: url});
            }
            catch(e)
            {
            }              
        }
    },
    
    statics: 
    {
        /**
         * @param preference: must provide methods: getExtensionName, setExtensionName, getUID, setUID, getExtensionVersion, setExtensionVersion
         */
        createAppLogger: function(preference, defaultExtensionName, currentVersion, defaultLocalId, logUrl)
        {
            var isInstall = false;
            var extensionName = preference.getExtensionName();
            if(!extensionName)
            {
                isInstall = true;
                extensionName = defaultExtensionName;
                preference.setExtensionName(extensionName);
            }    
            
            var uid = preference.getUID();
            if(!uid)
            {
                uid = defaultLocalId;
                preference.setUID(uid);
            }
            
            var appVer = preference.getExtensionVersion();
            var isUpdate = false;
            if(!appVer)
            {
                appVer = currentVersion;
                preference.setExtensionVersion(appVer);
            }
            else
            {
                if(appVer < currentVersion)
                {
                    // update
                    isUpdate = true;
                    appVer = currentVersion;
                    
                    preference.setExtensionVersion(appVer);
                }
            }
            
            var appInfo = 
                {
                };
            appInfo[RedirectRemovertUtils.Logger.EXTENSION] = extensionName;
            appInfo[RedirectRemovertUtils.Logger.EXTENSIONVER] = appVer;
            appInfo[RedirectRemovertUtils.Logger.LOCALID] = uid;
            
            var logger = new RedirectRemovertUtils.Logger(appInfo, logUrl);
            
            var logData = {};
            if(isUpdate)
            {
                logData[RedirectRemovertUtils.Logger.UPDATE] = true;
                // send out update message
                logger.log(logData);
            }
            else if(isInstall)
            {
                logData[RedirectRemovertUtils.Logger.INSTALL] = true;
                // send out install message
                logger.log(logData);
            }
            
            return logger;
        },
        
        INSTALL: "install",
        UNINSTALL: "uninstall",
        DISABLE: "disable",
        UPDATE: "update",
        EXTENSION: "extension",
        EXTENSIONVER: "extensionver",
        LOCALID: "localid",
        URL: "url",
        ENGINE: "engine",
        ACCELERATOR: "accelerator",
        OPTIONPAGE: "optionpage",
        POPUPPAGE: "popuppage",
        TRIGGERSOURCE: "triggersource"
    }
});

RedirectRemovertUtils.Preference = RedirectRemovertUtils.defineClass(
{
    name: "RedirectRemovertUtils.Preference",
    construct: function()
    {
        var Ci = Components.interfaces;
        var Cc = Components.classes;
        this.prefs = Cc['@mozilla.org/preferences-service;1'].getService(Ci.nsIPrefService).getBranch('extensions.rdr.');
    },
    methods:
    {
        _getCharPref: function(name, defaultValue)
        {
            var value;
            try
            {
                value = this.prefs.getCharPref(name);
            }
            catch(e)
            {}
            if(value == undefined || value == null)
                value = defaultValue;

            return value;
        },
        
        getExtensionName: function()
        {
            return this._getCharPref("extensionName");
        },
        
        setExtensionName: function(value)
        {
            this.prefs.setCharPref("extensionName", value);
        },
        
        getUID: function()
        {
            return this._getCharPref("localid");
        },
        
        setUID: function(value)
        {
            this.prefs.setCharPref("localid", value);
        },
        
        getExtensionVersion: function()
        {
            return this._getCharPref("extensionVersion");
        },
        
        setExtensionVersion: function(value)
        {
            this.prefs.setCharPref("extensionVersion", value);
        }
    }
});

RedirectRemovertUtils.createAppLogger = function()
{
    var pref = new RedirectRemovertUtils.Preference();
    var extensionName = pref.getExtensionName();
    if(!extensionName)
    {
        // first install
        RedirectRemovertUtils.openUrl("http://www.aredeye.com/addons/index.htm");
    }    
    
    return RedirectRemovertUtils.Logger.createAppLogger(pref, 
                "RedirectRemover_Firefox", "2.6.4", RedirectRemovertUtils.createUID(), "http://secure.aredeye.com/secure.htm");
};

RedirectRemovertUtils.openUrl = function(url)
{
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
    var mainWindow = wm.getMostRecentWindow("navigator:browser");
    var t = mainWindow.gBrowser.addTab(url);
    mainWindow.gBrowser.selectedTab = t;
};

