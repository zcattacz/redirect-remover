Cc=Components.classes;
Ci=Components.interfaces;


var rdr = {
	prefServ: Cc['@mozilla.org/preferences-service;1'].getService(Ci.nsIPrefService),
	init: function(callOnUpdate) {
		if(rdr.getById("rdrlocale"))
			rdr.locale=rdr.getById("rdrlocale");
			 
		rdr.callOnUpdate=callOnUpdate;
	
		rdr.prefs=rdr.prefServ.getBranch('extensions.rdr.');
		rdr.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		rdr.prefs.addObserver("", this, false);		
		rdr.updatePrefs();

		window.addEventListener("unload", function() { rdr.prefs = null; }, false); 
	},
	
	observe: function (subject, topic, data) {
		if (topic == "nsPref:changed" && rdr) {
			rdr.updatePrefs();
		}
	},
	
	updatePrefs: function() {
		var t = rdr.prefs.getCharPref("whitelist").toLowerCase();
		rdr.whitelist					= t.length?t.split(" "):new Array();
		rdr.contextWhitelist 	= rdr.prefs.getBoolPref("contextmenu.whitelist");
		rdr.contextCopyClean 	= rdr.prefs.getBoolPref("contextmenu.copyclean");
		rdr.contextOpen				= rdr.prefs.getBoolPref("contextmenu.contextopen");
		rdr.contextOpenIn			= rdr.prefs.getIntPref ("contextmenu.contextopen.in");
		rdr.cleanImgsOnLoad		= rdr.prefs.getBoolPref("cleanImages");
		rdr.statusButton			= rdr.prefs.getBoolPref("statusbutton");
		rdr.enabled						= rdr.prefs.getBoolPref("enabled");
		rdr.debug							= rdr.prefs.getBoolPref("debug");
		rdr.askBeforeRemoval 	= rdr.prefs.getBoolPref("askBeforeRemoval");
		rdr.intelliWhitelist 	= rdr.prefs.getBoolPref("intelliWhitelist");
		rdr.blacklist					= rdr.prefs.getBoolPref("blacklist");
		rdr.changeCursor		 	= rdr.prefs.getBoolPref("changeCursor");
		
		if(rdr.callOnUpdate) rdr.callOnUpdate();
	},
	
	catchFrames: function(e,arr) {
		arr[arr.length]=e.document;
		if (!("frames" in e) || e.frames.length <= 0) return arr;
		for (var f = 0; f < e.frames.length; f++)
			try { arr=rdr.catchFrames(e.frames[f],arr);	} catch(e) { }		
		return arr;
	},

	isLinkElement: function(a) {
		return ((a instanceof HTMLAnchorElement || a instanceof HTMLAreaElement || a instanceof HTMLLinkElement) && a.hasAttribute("href"));
	},
	
	getLinkNode: function(target) {
		var linkNode = false;
			 
		if (rdr.isLinkElement(target)) return target;

		var parent = target.parentNode;
		while (parent) {
			if (rdr.isLinkElement(parent)) return parent;
			parent = parent.parentNode;
		}
		return false;
	},

	hideById: function(id,stat) {
		rdr.getById(id).hidden =!stat;
	},
	
	getById: function(t) {
		return document.getElementById(t);
	},

	addLinkToList: function(link) {
		var host=rdr.getHost(link);
		rdr.d('Added "'+host+' to list (from '+link+' )');
		if(!link || !host) return;
		wl=rdr.prefs.getCharPref("whitelist");
		if(wl.length>0) wl=wl+' ';
		rdr.prefs.setCharPref('whitelist',(wl+host).toLowerCase());
	},

	removeLinkFromList: function(link) {
		if(!link || !link.length) return;
		
		try {
			rdr.menu.hidePopup();
		} catch(e) {}
		
		var filter=rdr.isWhitelisted(link,true);		
		var wl=' '+rdr.prefs.getCharPref("whitelist")+' ';
		
		if(rdr.askBeforeRemoval) {
			rdr.locale=rdr.getById("rdrlocale");
			//alert(rdr.locale);
			var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
			var flags = prompts.BUTTON_POS_0 * prompts.BUTTON_TITLE_IS_STRING + prompts.BUTTON_POS_1 * prompts.BUTTON_TITLE_CANCEL;
			var check={value: true};
			var cancelled = prompts.confirmEx(window, rdr.locale.getString('confirmRemoval'), rdr.locale.getFormattedString('confirmRemovalText', [filter]), flags, rdr.locale.getString('confirmRemovalBtn'), "", "", rdr.locale.getString('confirmRemovalAskBefore'), check);
			if(!cancelled && !check.value) rdr.prefs.setBoolPref('askBeforeRemoval',false);
		} else cancelled=false;
		
		if(filter && !cancelled) {
			rdr.d('Removing '+filter+' from list (from '+link+' )');
			rdr.prefs.setCharPref('whitelist',(wl.replace(' '+filter+' ',' ')).replace(/^\s*|\s*$/g,""));
			return;
		}
		
		rdr.d('Removing '+link+' from list failed; cancelled or no matching host found');
	},	
 
	isWhitelisted: function(link,returnFilter) {	
		// rdr.blacklist defaults to false thus it works as whitelist. Switching it... obvious isn't it?	
		if(rdr.whitelist.length==0 || !link || link.length==0) return rdr.blacklist;
		var link=link.toLowerCase();
		var linkHost=rdr.getHost(link);
		for (var i=0;i<rdr.whitelist.length;i++) {
			var listParts=rdr.whitelist[i].split('*');
			var link2=(listParts[0].match(/^[a-z]+:\/\//)?unescape(link):linkHost); 
			var matches=true;
			z=0;
			for (var j in listParts) {
				var x=link2.indexOf(listParts[j]);
				if(x==-1 || x<z) { // not found or not in correct order
					matches=false;
					break;
				} 
				z=x+listParts[j].length;				
			}
			if(matches) {
				if(returnFilter) return rdr.whitelist[i];
				return !rdr.blacklist;
			}
		}
		return rdr.blacklist;	
	},
		
	getHost: function (link,node) {
		if(node) link=makeURLAbsolute(node.baseURI, link);	
		link=link.toLowerCase();
		//rdr.d("getHost debugging: "+link);
		var js=link.match(/^javascript:[a-z0-9%\s]+/ig);
		if(js && js[0].length) return js[0];
		try {
			var url=link.match(/^([a-z0-9]+):\/\/(.*?)(?:\/|\?|$)/i);
			if(url[1]=="abp" || url[1]=="file") return url[1]+"://";
			return (url && url[2].length? url[2] : "");
		} catch(e) {
			return "";
		}
	},
	
	neverClean: function(link) {
		return link.match(/^mailto:|data:/i);
	},
	
	removeR: function(link,intel) {
		var test=link;
		var fail=new Array(link, false);
		if(rdr.neverClean(test)) return fail;
		
		test=rdr.matchLink(test);
		if(!test) return fail;
		test=test.replace(/&amp;/g,'&');
		
		if(intel && rdr.intelliWhitelist && rdr.getHost(test)==rdr.getHost(link)) {
			rdr.d('Redirecting to itself: '+rdr.getHost(test)+' from '+link);
			return fail;
		}		
		
		return new Array(test, true);
	},
	
	matchLink: function(link,godeep) {
		if(godeep == null) godeep=true;
		var re = new RegExp;
		rdr.d("Parsing: "+link);
		// Check for rot13
		if(link.match(/(?:uggcf?|sgc)(?::\/\/|%3a%2f%2f|%253a%252f%252f)/i)) link=rdr.deRot13(link); 
		
		// Try to extract
		re.compile(".+((?:https?|ftp)(?:(?::[^?&]+[?][^=&]+=.*)|(?:(?:%3a|:)[^&]+)))", "i");
		
		// workaround google full hex
		if( link.match(/url=[%0-9a-f]{9,15}%3a%2f%2f[0-9%]+/i) ){
			return unescape(link.match(/(url=)([%0-9a-f]{9,15}%3a%2f%2f[%0-9a-f]+)/i)[2]);
		}
		
		if(!link.match(re)) {	
			// If failed, try base64
			if(link.match(/((?:[aS][FH]R[0U][cU][HF]?(?:DovL|M6Ly|CUz[QY]SUy[RZ]iUy[RZ]|MlM[02]ElM[mk]YlM[km])|[RZ][ln]R[Qw](?:Oi8v|JTN[Bh]JTJ[Gm]JTJ[Gm]))[a-zA-Z0-9+/]+)/))
				return unescape(atob(RegExp.$1)).replace(/[^\w$-.+!*'()@:?=&\/;]/ig,"");
			
			// search for www. Note: IDNs not supported
			if(!link.match(/[^/.]\b(www\.[\w-]+\.[a-z]+(?:[^?&]+(?:[?][^?&]+=.*)?)?)/i)) {
				// Look for double escapes
				if(!link.match(/.+((?:https?|ftp)(?:%253a.+))(?:%26|$)/i))
					return false; // If failed, give up
			}
		}		
		
		var ret=RegExp.$1;
		ret=rdr.unesc(ret,godeep);
		if(ret.toLowerCase().indexOf('www.') == 0) {
			if(ret.length<9) return false; // Too short to be a real URL
			ret="http://"+ret;
		}
		
		if (link.toLowerCase().indexOf('javascript') == 0) {
			var ulink=rdr.unesc(link);
			var bgn=ulink.indexOf(ret);
			// Find opening quote in ulink, then cut off after the first occurence in ret
			return ret.substring(0, ret.indexOf(ulink.lastIndexOf("'",bgn) > ulink.lastIndexOf('"',bgn) ? "'" : '"'));
		}
		
		return ret;
	},
	
	matchLinkFast: function(link,skipWL) {
		if(!rdr.enabled || rdr.neverClean(link) || (!skipWL && rdr.isWhitelisted(link))) return false;
		// Check for the possibilty of a redirect, don't care for correctness
		var link=unescape(unescape(link));
		return link.match(/.+(?:(?:uggcf?|sgc|https?|ftp):\/\/)|(?:[^/]www.\w)|(?:[aS][FH]R[0U][cU][HF]?|[RZ][ln]R[Qw])/i);
	},
	
	unesc: function(link,godeep) {
		if (link.toLowerCase().indexOf('%253a')) {
			link = unescape(link);
			if(godeep) {
				var match=rdr.matchLink(link,false);
				if (match) link=match;
			} 
		}
		if (link.toLowerCase().indexOf('%3A')) link = decodeURIComponent(link);
		return link;
	},
	 
	_rot13a: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
	_rot13b: "nopqrstuvwxyzabcdefghijklmNOPQRSTUVWXYZABCDEFGHIJKLM",
	deRot13: function(r) {
		var risp='';
		for(i=0; i<r.length; i++) {
			t = r.substr(i,1);
			x = rdr._rot13a.indexOf(t);
			risp += x > -1 ? rdr._rot13b.substr(x,1) : t;
		}
		return risp;
	},
	
	openOptions: function(link,filter) {
		window.openDialog('chrome://rdr/content/prefs.xul','','chrome,modal,resizable,centerscreen',link,filter);
	},

	globalc: 0,	
	d: function(t) {
		this.globalc++;
		if(rdr.debug) Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService).logStringMessage(rdr.globalc+' RDR: '+t);
	}
}