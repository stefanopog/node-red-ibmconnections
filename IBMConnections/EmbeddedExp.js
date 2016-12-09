module.exports = function(RED) {
    function EmbeddedExpOut(config) {        
		RED.nodes.createNode(this,config);
 
		var endSlash = new RegExp("/" + "+$");
        var mailExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
		var node = this;
		var http = require("request");
        var xml2js = require("xml2js");
        var parser = new xml2js.Parser();

        function postAS(theMsg, server, myContext, target, myData, username, password) {    
            var myURL = "";
            //
            //  Build the final URL
            //
            myURL = server + myContext + "/opensocial/basic/rest/activitystreams/" + target + "/@all/@all?format=json";
            //	
            //	Dump to the Console
            //
            console.log("Posting Event to ActivtyStream : " + myURL);
            console.log(JSON.stringify(myData));
            //
            //  Issue the request
            //
            http.post(
                {
                    url: myURL, 
                    body: myData,
                    json: true,
                    method : 'POST',
                    headers:{
                      "Content-Type" : "application/json; charset=UTF-8",
                      "User-Agent" : "Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0"
                    }
                },
                function(error, response, body){
                    if (error) {
                        console.log("error posting the Event to the ActivityStream !");
                        node.status({fill:"red",shape:"dot",text:"ERROR"});
                        node.error(error.toString(), theMsg);
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300){
                            console.log("POST OK (" + response.statusCode + ")");
                            //
                            //	Have the node to emit the URL of the newly created event
                            //
                            url = body.entry.id;
                            node.status({fill:"green",shape:"dot",text:"delivered"});
                            theMsg.payload = body;
                            node.send(theMsg);
                        } else {
                            console.log("POST NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err4 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
                        } 
                    }
                }
            ).auth(username,password); // end http.post                        
        }

        //
        //	This to avoid issues on Self-Signed Certificates on Test Sites
        //
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; 

        this.on(
                'input', 
				function(msg) {
					var myData = {};
					var server;
					var myContext = "";
		            var target = "@me";
					//
					//	Retrieving Configuration from LOGIN node
					//
					var serverConfig = RED.nodes.getNode(config.server);
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
					//
					//	Setting the target URL for the EE post
					//
					if (server.toLowerCase().indexOf("w3-connections") != -1) {
						myContext = "/common";
					} else {
						myContext = "/connections";
					}				
					//
					//	Changing the name of the server in the payload message
					//	This is required if the "$$$server$$$" macro has been used to create the payload.
					//	The goal is to replace the macro with the actual NAME of the server
					//
					var tmp = JSON.stringify(msg.payload);
					tmp = tmp.replace(/\$\$\$server\$\$\$/g, server);
					myData = JSON.parse(tmp);
					//
					//	In case the message needs to be delivered to somebody else ....
					//
                    if (config.target == "myboard") {
                        target = "@me";
                        //
                        //  Post directly to "my" ActivityStream
                        //
                        postAS(msg, server, myContext, target, myData, username, password);                       
                    } else {
                        //
                        //  Check if mail address is entered
                        //
                        if ((config.targetValue == '') && ((msg.target == undefined) || (msg.target == ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing Target Information");
                            node.status({fill:"red",shape:"dot",text:"No Target"});
                            node.error('Missing TARGET Inforation', msg);
                         } else {
                            var mailAddr = '';
                            if (config.targetValue != '') {
                                mailAddr = config.targetValue;
                            } else if (msg.target != '') {
                                mailAddr = msg.target;
                            } 
                            if (mailExp.test(mailAddr)) {
                                //
                                //  target is mail address. Need to find the corresponding Uuid
                                //
                                var theURL = '';
                                if (serverConfig.serverType == "cloud") {
                                    theURL = server + "/profiles/atom/search.do?search=" + mailAddr;
                                } else {
                                    theURL = server + "/profiles/atom/profile.do?email=" + mailAddr;
                                }
                                http.get(
                                    {
                                        url: theURL, 
                                        method : "GET",
                                        headers:{
                                          "Content-Type" : "application/atom+xml",
                                          "User-Agent" : "Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0"
                                        }
                                    },
                                    function(error, response, body) {
                                        if (error) {
                                            console.log("error getting information for profile !" + mailAddr);
                                            node.status({fill:"red",shape:"dot",text:"Err1"});
                                            node.error(error.toString(), msg);
                                        } else {
                                            if (response.statusCode >= 200 && response.statusCode < 300) {  
                                                console.log("GET OK (" + response.statusCode + ")");
                                                console.log(body);
                                                //
                                                //	Have the node to emit the URL of the newly created event
                                                //
                                                parser.parseString(body, function (err, result) {
                                                    if (err) {
                                                        node.status({fill:"red",shape:"dot",text:"Parser Error"});
                                                        node.error("Parser Error posting to the AS", msg);
                                                        console.log("Parser Error posting to the AS");
                                                        console.log(err);
                                                        return;
                                                    }
                                                    if (result.feed.entry[0]) {
                                                        node.status({fill:"green",shape:"dot",text:"mail translated"});
                                                        //
                                                        target = "urn:lsid:lconn.ibm.com:profiles.person:" + result.feed.entry[0].contributor[0]['snx:userid'][0];
                                                        //
                                                        //  Build the "deliverTo"
                                                        //
                                                        myData.deliverTo = {"objectType" : "person", "id" : target};
                                                        //
                                                        //  Post to the ActivityStream
                                                        //
                                                        postAS(msg, server, myContext, target, myData, username, password);
                                                    } else {
                                                        node.status({fill:"red",shape:"dot",text:"Err2 "});
                                                        node.error('Err2', msg);
                                                        console.log("Parser Error posting to the AS - no ENTRY");
                                                        console.log(result);
                                                    }
                                                });
                                            } else {
                                                console.log("GET PROFILE NOT OK (" + response.statusCode + ")");
                                                console.log(body);
                                                node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                                                node.error(response.statusCode + ' : ' + response.body, msg);
                                            } 
                                        }
                                    } 
                                ).auth(username,password); 
                            } else {
                                //
                                //  We assume a Uuid is configured as targetValue or msg.target
                                //
                                target = "urn:lsid:lconn.ibm.com:profiles.person:" + mailAddr;
                                //
                                //  Build the "deliverTo"
                                //
                                myData.deliverTo = {"objectType" : "person", "id" : target};
                                //
                                //  Post to the ActivityStream
                                //
                                postAS(msg, server, myContext, target, myData, username, password);
                            }                            
                        }
                    }
                }
        );
    }
    
    RED.nodes.registerType("EmbeddedExpOut",  EmbeddedExpOut);

}
