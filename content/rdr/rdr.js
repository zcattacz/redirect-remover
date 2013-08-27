
var rdrb = {
	preventClean: false,
	overLink: null,
	lastLink: "",
	logger: null,
	fixup: Cc["@mozilla.org/docshell/urifixup;1"].getService(Ci.nsIURIFixup),
	hist: Cc["@mozilla.org/browser/global-history;2"].getService(Ci.nsIGlobalHistory2),
	// Adds all kinds of observers & injects code in order to clean links
	init: function () {
		window.removeEventListener("load",function() { rdrb.init(true); }, false);		

		rdr.init(rdrb.updateButtons);
		
        this.logger = RedirectRemovertUtils.createAppLogger();
		this.monitorExtensionState();

		getBrowser().addEventListener("click", rdrb.catchClick, true);
		getBrowser().addEventListener("mousedown", rdrb.catchMouseDown, true);
		if(rdr.getById("context-copylink")) rdr.getById("context-copylink").setAttribute("oncommand", "rdrb.resetLink();goDoCommand('cmd_copyLink')");
		
		var context=rdr.getById("contentAreaContextMenu");
		if(context) {
			context.addEventListener("popupshowing", function(event) { rdrb.contextMenuCheck(event); }, false);
			context.addEventListener("popuphiding",	function(event) { rdrb.contextMenuClean(event); }, false);
		}
		
		var appcontent = rdr.getById("appcontent");
		if(appcontent) appcontent.addEventListener("DOMContentLoaded", rdrb.cleanImgs, true);
		
		// Code injecting functions need to be delayed
		window.setTimeout("rdrb.delayedInit();",9);	
		
		window.addEventListener("mousemove", rdrb.cleanLastLink, false);
		this.sbText=rdr.getById("statusbar-display");
	}, 
	
    /**
     * monitor if our extension is disabled or uninstalled
     */
    monitorExtensionState: function()
    {
        var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
        observerService.addObserver(
            {
                observe: function(p_Subject, p_Topic, p_Data)
                {
                    if(p_Topic == "em-action-requested")
                    {
                        p_Subject.QueryInterface(Components.interfaces.nsIUpdateItem);
                        if(p_Subject.id == "{fe0258ab-4f74-43a1-8781-bcdf340f9ee9}")
                        {
                            var logData = {};
                            if(p_Data == "item-uninstalled")
                            {
                                logData[RedirectRemovertUtils.Logger.UNINSTALL] = true;
                                
                                RedirectRemovertUtils.openUrl("https://spreadsheets.google.com/viewform?formkey=dG9tWXkxVWphSFk0WkJUYV9MbEVXbWc6MA");
                            }
                            else if(p_Data == "item-disabled")
                            {
                                logData[RedirectRemovertUtils.Logger.DISABLE] = true;
                            }
                            else
                            {
                                return;
                            }
                            
                            rdrb.logger.log(logData);
                        }
                    }
                }
            },
        "em-action-requested", false);
    },
	
	cleanLastLink: function(evt) {
		if(!rdrb.lastLink && rdrb.overLink) {
			if(rdrb.overLink.style) rdrb.overLink.style.cursor="";
			rdrb.overLink=null;
		}
		if(!rdrb.lastLink) return;
		var linkNode=rdr.getLinkNode(evt.target);
		if(!linkNode || !linkNode.hasAttribute("href")) {
			rdrb.postLinkToStatusBar(rdrb.lastLink);
			return;
		}	
		
		if(linkNode.href==rdrb.lastLinkHref) {
			var cleanedLink=rdrb.lastLinkCleaned;
		} else {
			var clnArray=rdr.removeR(linkNode.href,true);
			rdrb.lastLinkCleanStat=clnArray[1];
			var cleanedLink=unescape(clnArray[0]);
		}			
		
		rdrb.lastLinkHref=linkNode.href;		
		if((!clnArray && rdrb.lastLinkCleanStat=="1") || (clnArray && clnArray[1])) {
			rdrb.postLinkToStatusBar(cleanedLink, true);
			rdrb.lastLinkCleaned=cleanedLink;
			if(rdr.changeCursor) {
				rdrb.overLink=linkNode;
				//linkNode.style.cursor = "url(chrome://rdr/skin/rdrmouse.png), pointer";
				linkNode.style.cursor = "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAcCAYAAABlL09dAAADE0lEQVR4Xu2VXUhTfxjHv+c4RVzOCUFbaWCWMbrypghsgeaF8DeU1AvdLublLvIFMQsrqkmC4Au+UNT/wreVV110Ic0JiaGzvDBD1phQgzMXzrGRbnMv7dfTSBCmHSd51xcezgvn+fx+z/d5+B0Oe4shLnAQFxhjCQB+Lyhp52OGQ4pHEvoHZqD46+DdjdyJpMHJLnIUHouOIy9S4qHhfEKJCYmJ90l7TKAkbBAHc6SjmeOjgEuSKXPLaoXLaIR3fh4xvx8k9EmlmOS4Rwww8oCV2+2x2K5ZLAbn2Bg+1tYiFgxC0daGPHrOGx9HxatXUOr17em5udNcSooGxDzwHK/RLoWhIeT39yPS1ISs4mLI8vJwLCcHx0tLcW5wEPlPnih5qfT/KKBNAO/ltd9mw5euLpzt7cVrjwcPm5vhdTgQJSuCPh9C4TACggA3LU7gtDSZrJMB5yUQEVmAk2VlsMvluFNejm0CbgcCICGakYELmZmoXFqCxOnE2WfP4JuaUqwNDGj3/TXtNPF9SQlO378PrrAQN+vr8WllBW23b0OmVMIzM4MfBgM2AchaWqChyrz0buX69QVRj6n74MhLOXXf0NGBWwT9r7ISagCqkRFcIY8VZNPE6ipstGiWSoVUufzUvmDyOh6CIMSvfir/RG4ubtBkuEdH8aGiAhxBTtN9UXU1MqJR2O128DwP7nfNf4wpmcziMJnYJj14AgFmNRjY2+xsZtXrWWCT3pIsFgu7qlaz6YUF5p2bY79yRK0Ib22ZfZOTiG5swNHYiM/t7UBNDVLJkm80Je9mZ/HwwQOcKSjApYsX4ZqYQIRyRMFcLDbqefnSZa2rQ9hsRkCrxUAohKaGBjRT3L13DyfJIkN3N0KLixCMRhcoRxTMA7agy3XHYzL9kBP88vPn0Oh00Gg00NCUPO7pQd/Tp0hfXsayTheKuN2tHOVIDnhSjVLEnMPDnQq/X6muqkJ6URFI2KaGfSWLnC9euCLr660pgBEkTuxsfbPr/IgBKgbUpmVlXaORygEp7PUK0e/fzSAgt+sQ+gn5v5BWY0YvsgAAAABJRU5ErkJggg=='), pointer";

			}
		} else {
			rdrb.lastLinkCleanStat=false;
			rdrb.postLinkToStatusBar(rdrb.lastLink, false);
		}
	},
	
	postLinkToStatusBar: function(link,app) {
		var text = (link && app?"RDR: ":"")+link;
		if(this.sbText.label!=text) this.sbText.label=text;
	},
	
	setOverLink: function(link, b) {
		// "link" is already escaped, making correct cleaning impossible. If a redirect exists, my own listener will handle it.
		// Reset Link after Drag&Drop
		link=link.replace(/[\u200e\u200f\u202a\u202b\u202c\u202d\u202e]/g, encodeURIComponent);
		if(rdr.matchLinkFast(link)) {
			rdrb.lastLink=link;
			return;
		}
		if(!link) rdrb.resetLink(true);
		if(rdrb.lastLink)
			rdrb.lastLink="";
		
		rdrb.postLinkToStatusBar(link, false);
	},
	
	delayedInit: function() {		 
		// For URLs in the statusbar
		try
		{
		if(nsBrowserStatusHandler)
			nsBrowserStatusHandler.prototype.setOverLink=rdrb.setOverLink;					
		}
		catch(e)
		{
		  try
		  {
		  	XULBrowserWindow.setOverLink=rdrb.setOverLink;
		  }
		  catch(e){}
		}
		try {
			// TabMix function "open multiple links". 
			if(window.openMultipleLinks) {
				eval("openMultipleLinks="+openMultipleLinks.toString().replace(
				'newTab =',
				'nextEpisode.href=rdrb.cleanLink(nextEpisode.href); newTab ='
				));
			} 
		} catch(e){}
				
		try {
			// AiO-Gestures should use cleaned links 
			if(window.aioGetHRef) {
				eval("aioGetHRef="+aioGetHRef.toString().replace(
				'node.href',
				'rdrb.cleanLink(node.href);'
				));
				eval("aioGetHRef="+aioGetHRef.toString().replace(
				'makeURLAbsolute(node.baseURI, node.getAttributeNS(xlinkNS, "href"))',
				'rdrb.cleanLink(makeURLAbsolute(node.baseURI, node.getAttributeNS(xlinkNS, "href")));'
				));
			}
		} catch(e){}
		
		try {
			// Smart Middle Click shouldn't open links if RDR can do it instead
			if(window.contentAreaClick2) {
				eval("contentAreaClick2="+contentAreaClick2.toString().replace(
				'wrapper = linkNode;',
				'wrapper = linkNode; '+
				'if(wrapper.href!=rdrb.cleanLink(wrapper.href)) return false;'
				));
			} 
		} catch(e){}
	},
	
	catchMouseDown: function(aEvt) {
		if (aEvt.button==0) {
			var wrapper=rdr.getLinkNode(aEvt.originalTarget);
			if(!wrapper || !wrapper.hasAttribute("href")) return;
			var clean=rdrb.cleanLink(wrapper.href);
			if(clean==wrapper.href) return false;
			
			rdrb.origlinkURL2=new Array(wrapper,wrapper.href);
			wrapper.href=clean;	
		}
	},
		
	catchClick: function(aEvt) {
		if (aEvt.button!= 2 && rdrb.contentAreaClick(aEvt)) // button=2 == right click
			aEvt.stopPropagation();
	},
		
	contentAreaClick: function(event) {
		if(rdrb.preventClean) return false;
		
		linkNode=rdr.getLinkNode(event.originalTarget);
				
		var wrapper = null;
		if (!linkNode) return false;

		wrapper = linkNode;

		clean=rdrb.cleanLink(wrapper.href);
		if(clean==wrapper.href) return false;

		// Add uncleaned link to history as well, so it's displayed as visited
		rdrb.addURLToHistory(wrapper.href,linkNode);
		
		rdrb.origlinkURL=new Array(wrapper,wrapper.href);
		window.setTimeout("rdrb.resetLink();",0);
		
		wrapper.href=clean;
		handleLinkClick(event, clean, wrapper);	
		return true;
	},
	
	addURLToHistory: function(url,node) {
		uri = rdrb.fixup.createFixupURI(url, 0);
		if (!rdrb.hist.isVisited(uri)) {
			rdrb.hist.addURI(uri, false, true, null);
			var oldHref = node.getAttribute("href");
			if (typeof oldHref == "string") {
				node.setAttribute("href", "");
				node.setAttribute("href", oldHref);
			}
		}
		return url;
	},
		
	cleanImgs: function(e) {
		var doc = e.originalTarget;
		if(doc.nodeName != "#document" || !rdr.cleanImgsOnLoad || !doc.images || doc.images.length==0) return;
		for(var i=0;i<doc.images.length;i++) {
			tmp=rdrb.cleanLink(doc.images[i].src);
			if(doc.images[i] && tmp!=doc.images[i].src) {
				doc.images[i].setAttribute("origsrc",doc.images[i].src);
				doc.images[i].setAttribute("src",tmp);
			}
		}
	},
	
	handleButtonClick: function(ev) {
		switch(ev.button) {
			case 0:
				if(ev.originalTarget.tagName!="toolbarbutton") {
					rdr.prefs.setBoolPref('enabled',!rdr.enabled);
					break;
				}
			case 2:
					var p=rdr.getById("rdrButtonMenu");
					rdrb.buttonMenuCheck(p);
					p.openPopup(ev.target , "after_start" ,-1,-1,true);
				break;
			case 1:
				rdr.openOptions();
				break;
		}
		return false;
	},
	
	buttonMenuCheck: function(ev) {
		rdrb.lastStatusClick=0;
		rdrb.menu=ev;
		// Clean previous entries
		while(x=ev.firstChild) ev.removeChild(x);

		var hasItems=false;
		var showedHosts=' ';
		try {
			var frames=rdr.catchFrames(content,new Array());
			for(var f=0;f<frames.length;f++) {
				var links=frames[f].links;
				for(var i=0;i<links.length;i++) {
					if(links[i].href==rdrb.cleanLink(links[i].href)) continue;
					showedHosts=rdrb.addMenuItem(ev,links[i].href,links[i],showedHosts);
					hasItems=true;
				}	 
					
				if(rdr.cleanImgsOnLoad) { 
					imgs=frames[f].images;
					for(var i=0;i<imgs.length;i++) {
						// Prevent fakes by webmasters
						var origSrc=imgs[i].hasAttribute("origsrc");
						if((origSrc && imgs[i].src==rdrb.cleanLink(imgs[i].getAttribute("origsrc"))) || imgs[i].src!=rdrb.cleanLink(imgs[i].src)) {
							showedHosts=rdrb.addMenuItem(ev,imgs[i].getAttribute(origSrc?"origsrc":'src'),imgs[i],showedHosts);
							hasItems=true;
						}
					}
				}
			}	
		} catch(e) { rdr.d('Unsupported document type: '+e.message); }
		
		if(!hasItems) {
			var item = document.createElement("menuitem");
			if(rdrb.is20) item.setAttribute("tooltiptext", rdrb.locale.getString('buttonNords')); // Firefox 2.0 Bug Workaround 
			item.setAttribute("label", rdr.locale.getString('buttonNords'));
			item.setAttribute("disabled", "true");
			ev.appendChild(item);
		}
		
		ev.appendChild(document.createElement("menuseparator"));
		
		var item = document.createElement("menuitem");
		if(rdrb.is20) item.setAttribute("tooltiptext", rdrb.locale.getString('buttonOpenoptions')); // Firefox 2.0 Bug Workaround 
		item.setAttribute("label", rdr.locale.getString('buttonOpenoptions'));
		item.setAttribute("accesskey", rdr.locale.getString('buttonOpenoptionsAccesskey'));
		item.setAttribute("oncommand", "rdr.openOptions();");
		ev.appendChild(item);
		
		item = document.createElement("menuitem");
		item.setAttribute("label", rdr.locale.getString('buttonEnablerdr'));
		if(rdrb.is20) item.setAttribute("tooltiptext", rdr.locale.getString('buttonEnablerdr')); // Firefox 2.0 Bug Workaround 
		item.setAttribute("accesskey", rdr.locale.getString('buttonEnablerdrAccesskey'));
			item.setAttribute("oncommand", "rdr.prefs.setBoolPref('enabled',!rdr.enabled);");
		item.setAttribute("type", "checkbox");
		item.setAttribute("checked", rdr.enabled);
		ev.appendChild(item);
		
	},
	
	addMenuItem: function(ev,link,node,showedHosts) {
		var host=rdr.getHost(link,node);
		rdr.d('Found '+host+' ('+link+')');
		if(showedHosts.indexOf(' '+host+' ')>=0) return showedHosts;
		showedHosts+=host+' ';					
		whtl=rdr.isWhitelisted(link,true);
		item = document.createElement("menuitem");
		item.setAttribute("id", "rdr-"+(whtl?'remove-from':'add-to')+"-list");
		item.setAttribute("class", "menuitem-iconic");
		item.setAttribute("label", whtl?whtl:host);
		item.setAttribute("tooltiptext", link);
		item.setAttribute("oncommand", (whtl?'rdrb.removeLinkFromList':'rdrb.addLinkToList')+'(this.getAttribute("tooltiptext"))');
		item.setAttribute("onclick", 'if(event.button==1) rdr.openOptions(this.getAttribute("tooltiptext")'+(whtl?',this.getAttribute("label")':'')+');');
		item.setAttribute("checked",whtl?'true':'false');
		ev.appendChild(item);
		return showedHosts;
	},
		
	contextMenuCheck: function(event) {
		if(event.target.getAttribute('id')!='contentAreaContextMenu' || !gContextMenu) return;
		if(rdrb.origlinkURL == null) {
			var link=gContextMenu.linkURL;
			if(rdr.matchLinkFast(link,true)) {
				var cleanedLinkArr=rdr.removeR(link);
				var cleanedLink=cleanedLinkArr[0];
				var containsR=(gContextMenu.onLink && cleanedLinkArr[1]);
				if(containsR) {
					var isOnList=rdr.isWhitelisted(link);
					rdr.d('Extracted '+cleanedLink+' from '+link);
					var isIntelliListed=rdr.intelliWhitelist && rdr.getHost(cleanedLink)==rdr.getHost(link);
					rdrb.origlinkURL=new Array(gContextMenu.link,link,isOnList,cleanedLink,isIntelliListed);
					if(rdr.enabled && !isOnList) {
						gContextMenu.linkURL=cleanedLink;
						gContextMenu.link.setAttribute("href",cleanedLink);
					}
				}
			}
		} else {
			var containsR=true;
			var isOnList=rdrb.origlinkURL[2];
			var isIntelliListed=rdrb.origlinkURL[4];
			var link=rdrb.origlinkURL[1];
			var cleanedLink=rdrb.origlinkURL[3];
		}
		rdr.hideById('rdr-copy-clean-link' ,(containsR && rdr.contextCopyClean));
		rdr.hideById('rdr-add-to-list'		 ,(containsR && !isOnList && rdr.contextWhitelist));
		rdr.hideById('rdr-remove-from-list',(containsR &&	isOnList && rdr.contextWhitelist));
		rdr.hideById('rdr-open-cleaned'		,(containsR && (!rdr.enabled || isOnList || isIntelliListed) && rdr.contextOpen));
		rdr.hideById('rdr-open-uncleaned'	,(containsR && (rdr.enabled && !isOnList && !isIntelliListed) && rdr.contextOpen));	
		
		if(containsR) {
			rdr.getById('rdr-open-cleaned').setAttribute("tooltiptext",unescape(cleanedLink));
			rdr.getById('rdr-open-uncleaned').setAttribute("tooltiptext",unescape(link));
			
			rdr.getById('rdr-copy-clean-link').setAttribute("tooltiptext",unescape(cleanedLink));
			
			rdr.getById('rdr-add-to-list').setAttribute("tooltiptext",rdr.getHost(link));
			rdr.getById('rdr-remove-from-list').setAttribute("tooltiptext",rdr.isWhitelisted(link,true));
		}
	},
	
	contextMenuClean: function(event) {
		if(event.target.getAttribute('id')=='contentAreaContextMenu') rdrb.resetLink();
	},
	
	resetLink: function(dnd) {
		if(dnd) {
			if(!rdrb.origlinkURL2) return;
			rdr.d('Cleaning DragDrop Link');
			rdrb.origlinkURL2[0].setAttribute('href',rdrb.origlinkURL2[1]);
			rdrb.origlinkURL2=null;
		} else {
			if(!rdrb.origlinkURL) return;
			rdr.d('Cleaning saved Link');
			rdrb.origlinkURL[0].setAttribute('href',rdrb.origlinkURL[1]);
			rdrb.origlinkURL=null;		
		}
	},
	
	copyCleanLink: function() {
		var oCB = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper);
		oCB.copyString(rdrb.origlinkURL[3]);
	},
	
	openLink: function(link, node) {
		// Execute JS Links in page context
		if(link.indexOf("javascript:")==0 && node) {
			rdrb.resetLink();
			var event = document.createEvent("MouseEvents");
			event.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
			// prevent RDR from intercepting
			rdrb.preventClean=true;
			node.dispatchEvent(event);
			rdrb.preventClean=false;
			return;
		}
		switch (rdr.contextOpenIn) {
			case 0: // here
				loadOneOrMoreURIs(link);
				break;
			case 2: // new window
				window.open(link);
				break;
			default: // new tab
				var t = gBrowser.addTab(link);
				if(!rdr.prefServ.getBoolPref('browser.tabs.loadInBackground')) {
					gBrowser.selectedTab = t;
					content.focus();
				}
		}
	},
	
	cleanLink: function(link) {
		if(!rdr.matchLinkFast(link)) return link;	 
		var c=rdr.removeR(link,true);
		return c[1] ? c[0] : link;
	},

	updateButtons: function() {
		var b=rdr.getById('rdr-button'); 
		if(b) {
			b.setAttribute('enabled',rdr.enabled);
			b.setAttribute('label',rdr.locale.getString(rdr.enabled?"rdrIsOn":"rdrIsOff"));
		}
		 
		b=rdr.getById('rdr-status-button');	 
		if(!b) return;		
		if(rdr.statusButton) {
			b.setAttribute('enabled',rdr.enabled);
			b.setAttribute('hidden','false');
			b.setAttribute('collapsed','false');
		} else {
			b.setAttribute('hidden','true');
			b.setAttribute('collapsed','true');
		} 
	}
}

window.addEventListener("load",function() { rdrb.init(); }, false);
