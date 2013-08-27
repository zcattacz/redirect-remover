rdr.init(updateOnPrefChange);
var onLink=false;
if(rdr.cleanImgsOnLoad && checkForImage)
	eval("checkForImage="+checkForImage.toString().replace('setInfo("image-url", imgURL);',
		'rdrParseMetaData(unescape(img.getAttribute("origsrc")?img.getAttribute("origsrc"):imgURL),"image");'
	));			 
		
if(checkForLink)
	eval("checkForLink="+checkForLink.toString().replace('setInfo("link-url", elem.href);','rdrParseMetaData(elem.href,"link");'));
	
function updateOnPrefChange() {
	onLink=false;
	// Can't call onLoad directly because it fails when FxIf is installed
	gMetadataBundle = document.getElementById("bundle_metadata");
	gLangBundle = document.getElementById("bundle_languages");
	gRegionBundle = document.getElementById("bundle_regions");
	showMetadataFor(window.arguments[0]);
}
	
function rdrParseMetaData(href,ref) {
	var isOnList=rdr.isWhitelisted(href,true); 
	var cleanedLink=rdr.removeR(href,false);
	setInfo(ref+"-url", href);
	
	if(cleanedLink[1]) {
		rdr.getById("rdrBlock"+ref).hidden=false; 
		setInfo(ref+"-url-cleaned", unescape(cleanedLink[0]));
		setInfo(ref+"-url-host", rdr.getHost(href));
		if(isOnList) {
			rdr.getById("rdr-remove-from-list-"+ref).setAttribute("tooltiptext",isOnList);
			rdr.hideById("rdr-add-to-list-"+ref,false);
			rdr.hideById("rdr-remove-from-list-"+ref,true);
		} else {
			rdr.getById("rdr-add-to-list-"+ref).setAttribute("tooltiptext",rdr.getHost(href));			
			rdr.hideById("rdr-add-to-list-"+ref,true);
			rdr.hideById("rdr-remove-from-list-"+ref,false);
		}
	}	
}

updateOnPrefChange();