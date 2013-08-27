var Ci = Components.interfaces;
var Cc = Components.classes;
var rdrPref = {
	prefs: Cc['@mozilla.org/preferences-service;1'].getService(Ci.nsIPrefService).getBranch('extensions.rdr.'),
	boolPrefs1: Array('chbWhitelist','chbContextOpen','chbCopyClean','chbCleanImages','chbStatusButton','chbChangeCursor'),
	boolPrefs2: Array('contextmenu.whitelist','contextmenu.contextopen','contextmenu.copyclean','cleanImages','statusbutton','changeCursor'),
	init: function() {
	    var logger = RedirectRemovertUtils.createAppLogger();
	    var logData = {};
	    logData[RedirectRemovertUtils.Logger.OPTIONPAGE] = true;
	    logger.log(logData);
	    
		this.defaultFilters=Cc['@mozilla.org/preferences-service;1'].getService(Ci.nsIPrefService).getDefaultBranch('extensions.rdr.').getCharPref('whitelist').toLowerCase();
		this._filters=' ';
		this.list=this.getById('permissionsBox');
		this._bundle = this.getById("bundlePreferences");
		this.fillList(); // Fills ignore-List
		for(var i=0;i<this.boolPrefs1.length;i++)
			this.getById(this.boolPrefs1[i]).checked=this.prefs.getBoolPref(this.boolPrefs2[i]);

		this.getById("removeAllPermissions").disabled = this.list.getRowCount() == 0;
		
		var textbox = this.getById("url");
		if(window.arguments && window.arguments[0]) {
			textbox.value=window.arguments[0];
			this.onHostInput(textbox);
		}
		textbox.focus();
		this.edBox=this.getById('edBox');

		window.addEventListener("resize", function() { rdrPref.acceptFilter(); }, false);		
		this.list.addEventListener("DOMMouseScroll", function() { rdrPref.acceptFilter(); }, false);
	},
		
	onHostInput: function () {
		this.getById("btnAllow").disabled = !this.getById("url").value.replace(/^(\w*:\/)?/, "");
	},
	
	onHostKeyPress: function (e) {
		if (e.keyCode == e.DOM_VK_RETURN || e.keyCode == e.DOM_VK_ENTER) {
			e.stopPropagation();
			e.preventDefault();
			this.getById("btnAllow").click();
		}
	},
	
	save: function () {
		for(var i=0;i<this.boolPrefs1.length;i++)
			this.prefs.setBoolPref(this.boolPrefs2[i],this.getById(this.boolPrefs1[i]).checked);

		this.prefs.setCharPref('whitelist',this.getListBoxValues());	
	},
		
	fillList:	function () {
		var items,item,prefIgnore=this.prefs.getCharPref('whitelist');
		if((prefIgnore.replace(/^\s*|\s*$/g,"")).length==0) return;
		items=prefIgnore.split(' ');
		for(var i=0;i<items.length;i++) this.addItem(items[i],(window.arguments && window.arguments[1]==items[i]),false);
	},
	
	checkForDefaultItem: function(listItem, filter) {
		listItem.setAttribute("style",((' '+this.defaultFilters+' ').indexOf(' '+filter+' ')>=0 ? "font-style: italic;" : ""));
	},
	
	addItem: function(filter,select,check,overwrite) {
		if (check && this.filterExists(filter)) return;
		filter=filter.toLowerCase();
		this._filters=(this._filters+filter+' ').toLowerCase();
		newItem=this.list.appendItem(filter, filter);
		this.checkForDefaultItem(newItem, filter);
		newItem.height=19;
		
		if(select) {
			this.onHostInput();
			this.getById("removeAllPermissions").disabled = this.list.getRowCount() == 0;
			window.setTimeout('l=rdrPref.list;i=l.getItemAtIndex('+rdrPref.list.getIndexOfItem(newItem)+');l.ensureElementIsVisible(i);l.selectItem(i);',0);
		}
	},
	
	filterExists: function(f) {
		if(this._filters.indexOf(' '+f.toLowerCase()+' ')>=0) return true;
		return false;
	},
	
	addDefaultFilters:	function () {
		var items=this.defaultFilters.split(' ');
		for(var i=0;i<items.length;i++) this.addItem(items[i],false,true);
	},
	
	cleanFilter: function(host) {
		var hostF=host.toLowerCase().replace(/\s+/g,"");
		if(hostF.indexOf('*')==-1) { // Normal URL matching
			try {
				var host = hostF.replace(/^\s*([-\w]*:\/+)?/, ""); // trim any leading space and scheme
				var promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
				try {
					var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
					var uri = ioService.newURI("http://"+host, null, null);
				} catch(ex) {
					var message = this._bundle.getString("invalidURI");
					var title = this._bundle.getString("invalidURITitle");
					promptService.alert(window, title, message);
					return false;
				}
				host=host.match(/^[^/?]+/);
				return host[0];
			} catch(e) {}
		} 
		return hostF.replace(/^\**|\**$/g,"").replace(/\*+/g,"*"); // Trims asteriks, removes double (or more) asteriks 
	},
	
	addPermission: function () {
		var textbox = this.getById("url");
		var host = this.cleanFilter(textbox.value);
		
		if(host) {
			this.addItem(host,true,true);
			textbox.value="";
			this.onHostInput();
		}
		textbox.focus();
	},
	
	onPermissionKeyPress: function (aEvent) {
		if (aEvent.keyCode == 46)
			this.onPermissionDeleted();
	},
	
	onPermissionSelected: function () {
		var hasSelection = this.list.selectedCount > 0;
		var hasRows = this.list.getRowCount() > 0;
		this.getById("removePermission").disabled = !hasRows || !hasSelection;
		this.getById("removeAllPermissions").disabled = !hasRows;
	},
	
	onPermissionDeleted: function (item) {
		if (!this.list.getRowCount() && !item) return;
		if(!item) var item=this.list.getSelectedItem(0);
		this._filters=this._filters.split(' '+item.label+' ').join(' ');
		var itemId=this.list.getIndexOfItem(item);
		this.list.removeItemAt(itemId);
		this.getById("removePermission").disabled = !this.list.getRowCount();
		this.getById("removeAllPermissions").disabled = !this.list.getRowCount();
		if(this.list.getRowCount() && this.list.selectedCount==0) this.list.selectedIndex=itemId == 0?0:itemId-1;
	},
	
	onAllPermissionsDeleted: function () {
		if (!this.list.getRowCount()) return;
		while(this.list.getRowCount()) this.list.removeItemAt(0);
		this._filters=' ';
		this.getById("removePermission").disabled = true;
		this.getById("removeAllPermissions").disabled = true;
	},
	
	getListBoxValues: function() {
		return this._filters.replace(/^\s*|\s*$/g,"");
	},
	
	editFilter: function() {
		if (!this.list.getRowCount()) return;
	 
		this.edItem=this.list.getSelectedItem(0);
		this.list.ensureElementIsVisible(this.edItem);
		this.edBox.value=this.edItem.value;
		// Hacky way to fix pixel-misalignes
		var adjustPx=parseInt(Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo).version)<3?1:0;
		if(adjustPx) this.edBox.inputField.setAttribute("style","padding-left:1px !important;");
		this.edBox.top=this.edItem.boxObject.screenY-this.list.boxObject.screenY-adjustPx;
		this.edBox.width=this.edItem.boxObject.width+2-adjustPx;
		this.edBox.left=this.edItem.boxObject.screenX-this.list.boxObject.screenX-1;
		this.edBox.hidden=false;
		this.edItem.style.visibility="hidden";
		
		window.setTimeout("try { rdrPref.edBox.select(); } catch(e) { rdrPref.d('No Select:'+e.description); }",0);
	},
	
	checkKeysOnFilter: function(e) {
		if(e.keyCode == KeyEvent.DOM_VK_RETURN || e.keyCode == KeyEvent.DOM_VK_ENTER) 
			this.acceptFilter();
		else if (e.keyCode==KeyEvent.DOM_VK_ESCAPE)
			this.edBox.hidden=true;
		else return;
		e.stopPropagation();
		e.preventDefault();
	},
	
	acceptFilter: function() {
		this.edBox.hidden=true;
		if(!this.edItem) return;	 
		this.edItem.style.visibility="visible";
		if(this.edBox.value=="") return this.onPermissionDeleted(this.edItem);
		var host=this.cleanFilter(this.edBox.value);
		if(this.filterExists(host)) return;
		this._filters=this._filters.split(' '+this.edItem.label+' ');
		this._filters=this._filters[0]+' '+host+' '+this._filters[1];
		this.edItem.value=this.edItem.label=host;
		this.checkForDefaultItem(this.edItem, host);
	},
	
	getById: function(t) {
		return document.getElementById(t);
	},
	
	d: function(t) {
		Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService).logStringMessage('rdr: '+t);
	}	
}
