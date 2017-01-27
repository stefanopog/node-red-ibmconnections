module.exports = function(RED) {
   function ProfilesOut(config) {
        RED.nodes.createNode(this,config);        

        var endSlash = new RegExp("/" + "+$");
        var node = this;
        var userId = "";
        var myURL = "";
        var newStatus = "";
        var newStatusJSON = "";

        this.customLabel = function(){
            return "Write a message to " + (config.target == "myboard" ? "my board" : "someone's board");
        };

        var http = require("request");

        this.on('input', function(msg) {
            var serverConfig = RED.nodes.getNode(config.server);

            var server   = "";
            var context  = "";
            var username = serverConfig.username;
            var password = serverConfig.password;

            //
            //	Retrieving Configuration from LOGIN node
            //
            if (serverConfig.serverType == "cloud") {
                if (serverConfig.cloudServer == "europe") {
                    server = "https://apps.ce.collabserv.com";
                } else {
                    server = "https://apps.na.collabserv.com";
                }
            } else {
                server   = serverConfig.server;
                //
                //	Remove trailing "slash" in case it is there
                //
                server   = server.replace(endSlash, "");
            }
            //
            //  Deal with specific W3-Connections
            //
            if (server.toLowerCase().indexOf("w3-connections") != -1) {
                context = "/common";
            } else {
                context = "/connections";
            }
            //
            //  Check if there is a message to send first
            //
            if ((config.status == '') && ((msg.payload == undefined) || (msg.payload == ''))) {
                //
                //  There is an issue
                //
                console.log("No Msg to be sent");
                node.status({fill:"red",shape:"dot",text:"No Msg to be sentr"});
                node.error('No Msg to be sent', theMsg);
                return;
             } else {
                if (config.status != '') {
                    newStatus = config.status;
                } else {
                    newStatus = msg.payload;
                }
                var myData = {};
                myData.content = newStatus;
                newStatusJSON = JSON.stringify(myData);
            }
            //
            //  Check to whom send the message
            //
            if (config.target == "myboard") {
                userId = "@me";
            } else {
                if ((config.userId == '') && ((msg.userId == undefined) || (msg.userId == ''))) {
                    //
                    //  There is an issue
                    //
                    console.log("Missing target user Information");
                    node.status({fill:"red",shape:"dot",text:"Missing Target User"});
                    node.error('Missing Target User', theMsg);
                    return;
                 } else {
                    if (config.userId != '') {
                        userId = config.userId;
                    } else {
                        userId = msg.userId;
                    }
                }
            }
            //
            //  Start Build target URL
            //
            myURL = server + context + "/opensocial/basic/rest/ublog/" + userId + "/@all";
            //
            //  Check if it is Comment
            //
            if (config.isComment) {
                if ((config.postId == '') && ((msg.postId == undefined) || (msg.postId == ''))) {
                    //
                    //  There is an issue
                    //
                    console.log("Missing PostIds Information");
                    node.status({fill:"red",shape:"dot",text:"Missing PostId"});
                    node.error('Missing PostId', theMsg);
                    return;
                 } else {
                    if (config.postId != '') {
                        postId = config.postId;
                    } else {
                        postId = msg.postId;
                    }
                    myURL += "/" + postId + "/comments";
                 }
            }
            //
            //  Now, let's send the message
            //
            node.status({fill:"blue",shape:"dot",text:"Posting..."});
            http.post(
                {
                    url: myURL,
                    body: newStatusJSON,
                    headers:{
                      "Content-Type" : "application/json; charset=UTF-8",
                      "User-Agent" : "Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0"
                    }
                },
                function(error,response,body){
                    if (error) {
                        console.log("error in posting : " + myURL);
                        node.status({fill:"red",shape:"dot",text:error.toSring()});
                        node.error(error.toString(), msg);
                    } else { 
                        if ((response.statusCode >= 200) && (response.statusCode < 300)) {
                            console.log("POST OK (" + response.statusCode + ")");
                            console.log(body);
                            var json = JSON.parse(body);
                            msg.status_url = json.entry.url;
                            node.status({});
                            node.send(msg);
                        } else {
                            console.log("POST TO PROFILE NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.statusMessage, msg);
                        }
                    }
                }
            ).auth(username,password); // end http.post
        });
    }
    
    RED.nodes.registerType(
        "ProfilesOut", 
        ProfilesOut,
        {
            credentials: {
                username: {type:"text"},
                password: {type:"password"}
            }
        }	    
    );

    
    function ProfilesGet(config) {      
        RED.nodes.createNode(this,config);        

        var endSlash = new RegExp("/" + "+$");
        var mailExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
		var node = this;
		var http = require("request");
        var xml2js = require("xml2js");
        var parser = new xml2js.Parser();
        var builder  = new xml2js.Builder({rootName: "content"});
        var target = "";
        var server = "";
        
        function _getUserDetail(record) {
            var person = {};
            var tmp = '';
            //
            //  This function retrieves the photo "sp_XX:div" from the VCARD
            //
            var kk = (function (a) { return a[Object.keys(a)[1]]})(record.content[0]);
            
            tmp = record.id[0];
            if (config.vcard) person['vcard'] = builder.buildObject(record.content[0]);
            if (config.key || config.links) person['key'] = tmp.split(':entry')[1];
            if (config.uuid) person['userid'] = record.contributor[0]['snx:userid'][0];
            if (config.mail) person['mail'] = record.contributor[0]['email'][0];
            if (config.thename) person['name'] = record.contributor[0]['name'][0];
            try {
                //if (config.photo) person['photo'] = record.content[0]['sp_0:div'][0]['span'][0]['div'][0]['img'][0]['$'].src;
                if (config.photo) person['photo'] = kk[0]['span'][0]['div'][0]['img'][0]['$'].src;
            } catch (err) {
                console.log('error trying to get Photo for user ' + person['name'] + '. Error is ' + err.message);
                console.log(record.content[0]);
                person['photo'] = '';
                node.warn('No photo for ' +  person['name']);
            }
            return person;                                     
        }

        function getForMe(theMsg, server, username, password) {
             http.get(
                {
                    url: server + '/profiles/atom/profileService.do', 
                    method: "GET",
                    headers:{
                      "Content-Type" : "application/atom+xml; charset=UTF-8",
                      "User-Agent" : "Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0"
                    }
                },
                function(error,response,body) {
                    if (error) {
                        console.log("error getting information for MY profile !");
                        node.status({fill:"red",shape:"dot",text:"No Profile Info"});
                        node.error(error.toString(), theMsg);
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            console.log("GET OK (" + response.statusCode + ")");
                            console.log(body);
                            //
                            //	Have the node to emit the URL of the newly created event
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill:"red",shape:"dot",text:"Parser Error"});
                                    node.error("Parser Error getForMe", theMsg);
                                    return;
                                }
                                if (result.service.workspace[0].collection[0]['snx:userid'][0]) {
                                    getForOther(theMsg, 
                                                server + '/profiles/atom/profile.do?userid=' + result.service.workspace[0].collection[0]['snx:userid'][0], 
                                                username, password);
                                } else {
                                    console.log(err);
                                    node.status({fill:"red",shape:"dot",text:"No Entry "});
                                    node.error('Missing <ENTRY> element', theMsg);
                               }
                            });
                        } else {
                            console.log("GET PROFILE NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.statusMessage, theMsg);
                        }
                    }
                }
            ).auth(username,password); // end http.post           
        }
        

        function getForOther(theMsg, theURL, username, password) {
             http.get(
                {
                    url: theURL, 
                    method: "GET",
                    headers:{
                      "Content-Type" : "application/atom+xml; charset=UTF-8",
                      "User-Agent" : "Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0"
                    }
                },
                function(error,response,body) {
                    if (error) {
                        console.log("error getting information for profile : " + theURL);
                        node.status({fill:"red",shape:"dot",text:"No Profile Info"});
                        node.error(error.toString(), theMsg);
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            console.log("GET OK (" + response.statusCode + ")");
                            console.log(body);
                            //
                            //	Have the node to emit the URL of the newly created event
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill:"red",shape:"dot",text:"Parser Error"});
                                    node.error("Parser Error getForOther", theMsg);
                                    return;
                                }
                                if (result.feed.entry) {
                                    theMsg.payload = _getUserDetail(result.feed.entry[0]);
                                    if (config.links) {
                                        //
                                        //  Fetch Linkroll
                                        //  Since this is another REST call, the task to return control to
                                        //  the flow is left to the function that will be invoked (and, thus, to
                                        //  its callback function)
                                        //
                                        _getProfileLinks(theMsg, theMsg.payload, username, password);
                                    } else {
                                        //
                                        //  Safely return node results as no other action is required
                                        //
                                        node.status({});
                                        node.send(theMsg);
                                    }
                                } else {
                                    console.log(err);
                                    node.status({fill:"red",shape:"dot",text:"No Entry "});
                                    node.error('Missing <ENTRY> element', theMsg);
                                    return;
                               }
                            });
                        } else {
                            console.log("GET PROFILE NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
                        }
                    }
                }
            ).auth(username,password); // end http.post           
        }

        function getByParams(theMsg, theURL, username, password) {
             http.get(
                {
                    url: theURL, 
                    method: "GET",
                    headers:{
                      "Content-Type" : "application/atom+xml; charset=UTF-8",
                      "User-Agent" : "Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0"
                    }
                },
                function(error,response,body) {
                    if (error) {
                        console.log("error getting information by PARAMS : " + theURL);
                        node.status({fill:"red",shape:"dot",text:"No Profile Info"});
                        node.error('No Profile Info', theMsg);
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            console.log("GET OK (" + response.statusCode + ")");
                            console.log(body);
                            //
                            //	Have the node to emit the URL of the newly created event
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill:"red",shape:"dot",text:"Parser Error"});
                                    node.error("Parser Error getByParams", theMsg);
                                    return;
                                }
                                if (result.feed.entry) {
                                    //
                                    var myData = new Array();
                                    for (i=0; i < result.feed.entry.length; i++) {
                                        myData.push(_getUserDetail(result.feed.entry[i]));
                                    }
                                    theMsg.payload = myData;
                                    node.status({});
                                    node.send(theMsg);
                                } else {
                                    console.log(err);
                                    node.error('Missing <ENTRY> element', theMsg);
                                    node.status({fill:"red",shape:"dot",text:"No Entry "});
                               }
                            });
                        } else {
                            console.log("GET PROFILE NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
                        }
                    }
                }
            ).auth(username,password); // end http.post           
        }

        //
        //  The following method must be called as the last one of a chain since it performs the
        //  closing operations and the transfer to the flow
        //  When an error is found, it does NOT return an error to the flow. It simples signals with a YELLOW DOT
        //  and DOES NOT fill the payload.linkroll property
        //
        function _getProfileLinks(theMsg, data, username, password) {
            var theURL = server + '/profiles/atom/profileExtension.do?key=' + data.key + '&extensionId=profileLinks';
            http.get(
                {
                    url: theURL,
                    method: "GET",
                    headers:{
                      "Content-Type" : "application/atom+xml; charset=UTF-8",
                      "User-Agent" : "Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0"
                    }
                },
                function(error,response,body) {
                    if (error) {
                        console.log("error getting profileLinks for profile : " + theURL);
                        node.status({fill:"yellow",shape:"dot",text:"No Profile Info"});
                    } else {
                        if (response.statusCode == 200) {
                            console.log("GET OK (" + response.statusCode + ")");
                            console.log(body);
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill:"yellow",shape:"dot",text:"Parser Error _getProfileLinks"});
                                } else {
                                    var links = [];
                                    for (i=0; i < result.linkroll.link.length; i++) {
                                        var theLink = {};
                                        theLink.name = result.linkroll.link[i]["$"].name;
                                        theLink.url = result.linkroll.link[i]["$"].url;
                                        links.push(theLink);
                                    }
                                    theMsg.payload.linkroll = links;
                                    console.log(theMsg.payload.linkroll);
                                    //
                                    //  Return control to the flow
                                    //
                                    node.status({});
                                }
                            });
                        } else {
                            console.log("GET PROFILELINKS NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"yellow",shape:"dot",text:" _getProfileLinks " + response.statusMessage});
                        }
                    }
                    node.send(theMsg);
                }
            ).auth(username,password); // end http.post
        }
        
        
        //function getProfileLinks(theMsg, data, username, password) {
            //
            //  We need to retrieve ProfileLinks for all the persons that have been retrieved from the previous calls
            //
            //for (i=0; i < data.length; i++) {
            //    _getProfileLinks(theMsg, data[i], username, password);
            //    JSON.stringify(data[i], ' ', 2);
            //}
        //}
       
        this.on(
            'input', 
            function(msg) {
                var serverConfig = RED.nodes.getNode(config.server);
                var myURL = "";
                //
                //  Server is a GLOBAL variable
                //
                server   =  serverConfig.server;
                //
                //	Retrieving Configuration from LOGIN node
                //
                if (serverConfig.serverType == "cloud") {
                    if (serverConfig.cloudServer == "europe") {
                        server = "https://apps.ce.collabserv.com";
                    } else {
                        server = "https://apps.na.collabserv.com";
                    }
                } else {
                    server   = serverConfig.server;
                    //
                    //	Remove trailing "slash" in case it is there
                    //
                    server   = server.replace(endSlash, ""); 
                }
                var username =  serverConfig.username;
                var password =  serverConfig.password;

                switch (config.target) {
                    case "byKeyword" :
                        if ((config.mykeywords == '') && ((msg.keywords == undefined) || (msg.keywords == ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing Keywords Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Keywords"});
                            node.error('Missing Keywords', theMsg);
                         } else {
                            var theKeywords = '';
                            if (config.mykeywords != '') {
                                theKeywords = config.mykeywords;
                            } else {
                                theKeywords = msg.keywords;
                            } 
                            myURL = server  + "/profiles/atom/search.do?sortBy=relevance&search=" + theKeywords + '&format=full&ps=1000';
                            //
                            // get Profile By Tags
                            //
                            node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                            getByParams(msg, myURL, username, password);
                        }
                        break;
                    case "byTag" :
                        if ((config.mytags == '') && ((msg.tags == undefined) || (msg.tags == ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing Tags Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Tags"});
                            node.error('Missing Tags', theMsg);
                         } else {
                            var theTags = '';
                            if (config.mytags != '') {
                                theTags = config.mytags;
                            } else {
                                theTags = msg.tags;
                            } 
                            myURL = server  + "/profiles/atom/search.do?profileTags=" + theTags + '&format=full&ps=1000';
                            //
                            // get Profile By Tags
                            //
                            node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                            getByParams(msg, myURL, username, password);
                        }
                        break;
                    case "syntaxSearch" : 
                        if ((config.freesyntax == '') && ((msg.freeSyntax == undefined) || (msg.freeSyntax == ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing Free Syntax Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Syntax"});
                            node.error('Missing Syntax', theMsg);
                         } else {
                            var freeSyntax = '';
                            if (config.freesyntax != '') {
                                freeSyntax = config.freesyntax;
                            } else {
                                freeSyntax = msg.freeSyntax;
                            } 
                            myURL = server  + "/profiles/atom/search.do?" + freeSyntax;
                            console.log(myURL);
                            //
                            // get Profile By Tags
                            //
                            node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                            getByParams(msg, myURL, username, password);
                        }
                        break;
                    case "myself" :
                        //
                        // get Profile Informations
                        //
                        node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                        getForMe(msg, server, username, password);
                        break;
                    case "person" :
                        //
                        //	In case the message needs to be delivered to somebody else ....
                        //  Check if mail address is entered
                        //
                        if ((config.targetValue == '') && ((msg.target == undefined) || (msg.target == ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing Target Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Target"});
                            node.error('Missing Target', theMsg);
                         } else {
                            var mailAddr = '';
                            if (config.targetValue != '') {
                                mailAddr = config.targetValue;
                            } else {
                                mailAddr = msg.target;
                            } 
                            if (mailExp.test(mailAddr)) {
                                //
                                //  Retrieve By Mail
                                //
                                if (serverConfig.serverType == "cloud") {
                                    myURL = server + "/profiles/atom/search.do?search=" + mailAddr + '&format=full';
                                } else {
                                    myURL = server + "/profiles/atom/profile.do?email=" + mailAddr;
                                }
                            } else {
                                //
                                //  Retrieve by Uuid
                                //
                                myURL = server + "/profiles/atom/profile.do?userid=" + mailAddr;
                            }
                            //
                            // get Profile Informations
                            //
                            node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                            getForOther(msg, myURL, username, password);
                        }
                        break;
                }
             }
        );
    }
    
    RED.nodes.registerType("ProfilesGet",  ProfilesGet);
    
}
