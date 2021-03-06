// EcmaScript5 compatibility 
if (!Object.keys) {  
  Object.keys = (function () {  
    var hasOwnProperty = Object.prototype.hasOwnProperty,  
        hasDontEnumBug = !({toString: null}).propertyIsEnumerable('toString'),  
        dontEnums = [  
          'toString',  
          'toLocaleString',  
          'valueOf',  
          'hasOwnProperty',  
          'isPrototypeOf',  
          'propertyIsEnumerable',  
          'constructor'  
        ],  
        dontEnumsLength = dontEnums.length  ;
  
    return function (obj) {  
      if (typeof obj !== 'object' && typeof obj !== 'function' || obj === null) throw new TypeError('Object.keys called on non-object')  
  
      var result = []  ;
  
      for (var prop in obj) {  
        if (hasOwnProperty.call(obj, prop)) result.push(prop)  
      }  
  
      if (hasDontEnumBug) {  
        for (var i=0; i < dontEnumsLength; i++) {  
          if (hasOwnProperty.call(obj, dontEnums[i])) result.push(dontEnums[i])  
        }  
      }  
      return result  ;
    };  
  })()  ;
};

// Fallback if getScreenBBOx not implemented
// from http://my.opera.com/MacDev_ed/blog/getting-screen-boundingboxes-in-svg
if(!document.documentElement.getScreenBBox) {
     // load the fallback js implementation if necessary
    SVGElement.prototype.getScreenBBox = function() {
      return getScreenBBox_impl(this);	
    };
}

var svgns = "http://www.w3.org/2000/svg";
var xlinkns = "http://www.w3.org/1999/xlink";
var xhtmlns = "http://www.w3.org/1999/xhtml";
var roomsCounter = {};
var rooms = {};
var youareherePoint = document.createElementNS(svgns, "circle");
var floors = {};
// @@@ too specific
var zoomedFloor = document.getElementById("repl" + 0);

youareherePoint.setAttribute( "r", "2px");
youareherePoint.setAttribute( "id", "you");
youareherePoint.setAttribute( "fill", "red");


function updateYouAreHere(entered, left) {
    if (left) {
	var there = document.getElementById(left);
	if (there) {
	    there.setAttribute("class", "room");
	}
    }
    var here = document.getElementById(entered);
   if (here) {
        here.setAttribute("class", "room youarehere");
        var bbox = here.getScreenBBox();
        youareherePoint.setAttribute( "cx", bbox.x + bbox.width/2);
        youareherePoint.setAttribute( "cy", bbox.y + bbox.height/2);
        if (!document.getElementById("you")) {
	    document.documentElement.appendChild(youareherePoint);
        }
    }
}

if (window.location.hash) {
    var id = window.location.hash.substring(1).split(',')[0];
    var room = document.getElementById(id);
    if (room) {
	room.parentNode.removeAttribute("xlink:href");
	room.style.fill = "yellow";
    }

    var currentLocation = window.location.hash.substring(1).split(',')[1];
    if (currentLocation) {
	updateYouAreHere(currentLocation, null);
    }
    var currentFloor = window.location.hash.substring(1).split(',')[2];
    if (currentFloor !== undefined && currentFloor !== '') {
	showFloor(currentFloor);
    } else {
	showFloor(0);
    }
}

// finding the rooms via their links to decorate them with a counter box
var room_links = document.getElementsByTagNameNS(svgns, "a");
// adding the counter
for (var r =0 ;r < room_links.length ; r++) {
    var room = room_links[r].getElementsByTagNameNS(svgns, "rect")[0];
    if (!room){
	room = room_links[r].getElementsByTagNameNS(svgns, "path")[0];
    }
    var bbox = room.getScreenBBox();
    var backdrop = document.createElementNS(svgns, "rect");
    backdrop.setAttribute("id", room.getAttribute("id") + "-counter-backdrop");
    backdrop.setAttribute("x", bbox.x + bbox.width - 12);
    backdrop.setAttribute("width", 10);
    backdrop.setAttribute("y", bbox.y + bbox.height - 12);
    backdrop.setAttribute("height", 10);
    var t = document.createElementNS(svgns, "text");
    t.setAttribute("id", room.getAttribute("id") + "-counter");
    t.setAttribute( "x", bbox.x + bbox.width - 8);
    t.setAttribute( "y", bbox.y + bbox.height- 3);
    t.setAttribute( "text-anchor", "middle");    
    room_links[r].appendChild(backdrop);
    room_links[r].appendChild(t);
}
var xhr = new XMLHttpRequest;
xhr.open("GET","../locations.json", true);
xhr.onreadystatechange = function() {
    if (4 == xhr.readyState) {
        rooms = JSON.parse(xhr.responseText);
        for (var roomShortname in rooms) {
	    if (rooms[roomShortname].level !== undefined) {
		if (!floors[rooms[roomShortname].level]) {
		    floors[rooms[roomShortname].level] = [];
		}
		floors[rooms[roomShortname].level].push(roomShortname)
	    }
	    if (rooms[roomShortname].checkedin.length) {
		updateCounter( rooms[roomShortname].shortname, rooms[roomShortname].checkedin.length );
            } 
        }
    }
};
xhr.send();   

var tweetQueue = [];
if (window.EventSource) {
    // Live update!
    var evtSrc = new EventSource( "../locations/stream" );
    evtSrc.onmessage = function( e ) {
	// @@@ check origin
	data = JSON.parse(e.data);
	moveUser(data.left.shortname, data.entered.shortname, data.user);
	setTimeout((function(left, entered, you) {
	    return function() {	
		updateCounter(left, -1);
		updateCounter(entered, +1);	    
		if (you) {
		    updateYouAreHere(entered, left);
		}
	    };
	})(data.left.shortname, data.entered.shortname, data.you), 3000);
    };
    evtSrc.addEventListener("tweet", function(tweet) {
	// @@@ check origin
	data = JSON.parse(tweet.data);
	if (data.position) {
	    displayTweet(data.text, data.user.screen_name, data.user.profile_image_url_https, data.id, data.position);
	}
    }, false);
}


function displayTweet(text, screen_name, profile_image, id, room) {
    var roomBox = document.getElementById(room);
    if (roomBox) {
	var backbox = document.createElementNS(svgns, "rect");
	var box = document.createElementNS(svgns, "foreignObject");
	var animateFadein = document.createElementNS(svgns, "animate");
	var animateFadeout = document.createElementNS(svgns, "animate");
	var bbox = roomBox.getScreenBBox();
	backbox.setAttribute("x", bbox.x + bbox.width / 2 - 5);
	backbox.setAttribute("id", "tweet" + id);
	backbox.setAttribute("y", bbox.y + bbox.height / 2 - 15 );
	backbox.setAttribute("width","250");
	backbox.setAttribute("height","80");
	backbox.setAttribute("fill", "white");
	backbox.setAttribute("stroke", "black");
	backbox.setAttribute("stroke-width", "2");
	box.setAttribute("x", bbox.x + bbox.width / 2);
	box.setAttribute("y", bbox.y + bbox.height / 2);
	box.setAttribute("width","200");
	box.setAttribute("height","60");
	box.setAttribute("fill", "black");
	var div =  document.createElementNS(xhtmlns, "div");
	div.setAttribute("style", "font-size:10px");
	var img = document.createElementNS(svgns, "image");
	img.setAttributeNS(xlinkns, "href", profile_image);
	img.setAttribute("x", bbox.x + bbox.width / 2 - 36 );
	img.setAttribute("width", 36 );
	img.setAttribute("y", bbox.y + bbox.height / 2 );
	img.setAttribute("height", 48 );
	var a = document.createElementNS(xhtmlns, "a");
	a.appendChild(document.createTextNode(screen_name));
	a.setAttribute("href", "https://twitter.com/" + screen_name+ "/statuses/" + id);
	div.appendChild(a);
	div.appendChild(document.createTextNode(": " + text));
	box.appendChild(img);
	box.appendChild(div);
	animateFadein.setAttribute("attributeName", "opacity");
	animateFadein.setAttribute("from", "0");
	animateFadein.setAttribute("to", "1");
	animateFadein.setAttribute("dur", "1s");
	animateFadein.setAttribute("fill", "freeze");
	animateFadein.setAttribute("begin", backbox.getAttribute("id") + ".load");
	animateFadeout = animateFadein.cloneNode(true);
	animateFadeout.setAttribute("from", "1");
	animateFadeout.setAttribute("to", "0");
	animateFadeout.setAttribute("begin", backbox.getAttribute("id") + ".load + 9s");
	backbox.appendChild(animateFadein);
	backbox.appendChild(animateFadeout);
	document.documentElement.appendChild(backbox);
	document.documentElement.appendChild(box);
	setTimeout(function() {
	    document.documentElement.removeChild(backbox);
	    document.documentElement.removeChild(box);
	}, 10000);
    }
}

function moveUser (left, entered, user) {
    var avatarId = "avatar_" + user.login;
    var avatar = document.getElementById(avatarId);
    var leftBox = document.getElementById(left).getScreenBBox();
    var enteredBox = document.getElementById(entered).getScreenBBox();

    if (!avatar) {
	var name = document.createTextNode(user.given + " " + user.family);
	if (user.picture_thumb) {
	    avatar = document.createElementNS(svgns, "image");
	    avatar.setAttribute("width",36);
	    avatar.setAttribute("height",48);
	    avatar.setAttributeNS(xlinkns, "href", user.picture_thumb);
	    var title = document.createElementNS(svgns, "title");
	    title.appendChild(name);
	    avatar.appendChild(title);
	} else {
	    avatar = document.createElementNS(svgns, "text");
	    avatar.setAttribute("text-anchor", "middle");
	    avatar.appendChild(name);
	}
	avatar.setAttribute("id",avatarId);
	avatar.setAttribute("x", leftBox.x + leftBox.width / 2);
	avatar.setAttribute("y", leftBox.y + leftBox.height / 2);
	var animateFadein = document.createElementNS(svgns, "animate");
	var animateFadeout;
	var animateX = document.createElementNS(svgns, "animate");
	var animateY = document.createElementNS(svgns, "animate");
	animateFadein.setAttribute("attributeName", "opacity");
	animateFadein.setAttribute("from", "0");
	animateFadein.setAttribute("to", "1");
	animateFadein.setAttribute("dur", "1s");
	animateFadein.setAttribute("fill", "freeze");
	animateFadein.setAttribute("id", user.login + "_fadein");
	animateFadein.setAttribute("begin", avatarId + ".load");
	animateFadeout = animateFadein.cloneNode(true);
	animateFadeout.setAttribute("from", "1");
	animateFadeout.setAttribute("to", "0");
	animateFadeout.setAttribute("begin", user.login + "_moveX.end");
	animateX.setAttribute("attributeName", "x");
	animateX.setAttribute("from", leftBox.x + leftBox.width / 2);
	animateX.setAttribute("to", enteredBox.x + enteredBox.width / 2);
	animateX.setAttribute("dur", "2s");
	animateX.setAttribute("fill", "freeze");
	animateX.setAttribute("id", user.login + "_moveX");
	animateX.setAttribute("begin", user.login + "_fadein.end");
	animateY.setAttribute("attributeName", "y");
	animateY.setAttribute("id", user.login + "_moveY");
	animateY.setAttribute("from", leftBox.y + leftBox.height / 2);
	animateY.setAttribute("to", enteredBox.y + enteredBox.height / 2);
	animateY.setAttribute("dur", "2s");
	animateY.setAttribute("begin", user.login + "_fadein.end");
	animateY.setAttribute("fill", "freeze");
	avatar.appendChild(animateX);
	avatar.appendChild(animateY);
	avatar.appendChild(animateFadein);
	avatar.appendChild(animateFadeout);
	document.documentElement.appendChild(avatar);

    } else {
	var animateX = document.getElementById(user.login + "_moveX");
	animateX.setAttribute("from", leftBox.x + leftBox.width / 2);
	animateX.setAttribute("to", enteredBox.x + enteredBox.width / 2);
	var animateY = document.getElementById(user.login + "_moveY");
	animateY.setAttribute("from", leftBox.y + leftBox.height / 2);
	animateY.setAttribute("to", enteredBox.y + enteredBox.height / 2);
	avatar.setAttribute("x", leftBox.x + leftBox.width / 2);
	avatar.setAttribute("y", leftBox.y + leftBox.height / 2);	
	reloadAvatar = avatar.cloneNode(true);
	document.documentElement.removeChild(avatar);
	document.documentElement.appendChild(reloadAvatar);
    }
}

function updateCounter(roomid, counterIncrement) {       
    var room = document.getElementById( roomid);
    var counterText = document.getElementById( roomid +  "-counter");
    var counterBackdrop = document.getElementById( roomid +  "-counter-backdrop");
    if (!roomsCounter[roomid]) {
	roomsCounter[roomid] = 0;
    }
    roomsCounter[roomid] += counterIncrement;
    if (room) {
        var roomTitle = room.parentNode.getAttribute("title");
	if (roomTitle.indexOf('(') != -1) {
	    roomTitle = roomTitle.substring(0,roomTitle.indexOf('(') - 1);
	}
        if (roomsCounter[roomid] > 0) {   
            room.parentNode.setAttribute('title', roomTitle + " (" + roomsCounter[roomid] + " person" + (roomsCounter[roomid] > 1 ? "s" : "") + " checked in)");
	    counterBackdrop.setAttribute( "fill", "white");
            counterText.textContent = roomsCounter[roomid];
	} else {
            counterText.textContent = "";
	    counterBackdrop.setAttribute( "fill", "none");
            room.parentNode.setAttribute('title', roomTitle);
        }
    }
}

function showFloor(floor) {
    zoomedFloor.setAttribute("visibility", "hidden");
    zoomedFloor = document.getElementById("repl" + floor);
    zoomedFloor.setAttribute("visibility", "visible");
}