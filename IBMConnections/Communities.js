module.exports = function(RED) {
    function parseAtomEntry(entry, isAtom) {
        var xml2js = require("xml2js");
        var builder  = new xml2js.Builder({rootName: "entry"});
        var community = {};
        if (entry.title && entry.title[0]['_']) {
            community['title'] = entry.title[0]['_'];
        } else if(entry.title && entry.title[0]) {
            community['title'] = entry.title[0];
        }
        if (entry.id) {
            community['id'] = entry.id[0];
        }
        if(entry.link) {
          for (j=0; j < entry.link.length; j++ ) {
            var tmp = entry.link[j];
            if (tmp['$'].rel === "self") {
                community['ref'] = tmp['$'].href;
                break;
            }
          }
        }
        if (entry['snx:communityType']) {
            community['communityType'] = entry['snx:communityType'][0];
        }
        if (entry['snx:isExternal']) {
            community['isExternal'] = entry['snx:isExternal'][0];
        }
        if (entry['snx:communityUuid']) {
            community['Uuid'] = entry['snx:communityUuid'][0];
        }
        community['entry'] = builder.buildObject(entry);
        community['originalentry'] = entry;
        return community;
    }

    function CommunitiesGet(config) {
        RED.nodes.createNode(this,config);

        var endSlash = new RegExp("/" + "+$");
        var node     = this;
        var http     = require("request");
        var xml2js   = require("xml2js");
        var parser   = new xml2js.Parser();

        function getCommunityList(theMsg, theURL, username, password) {
             http.get(
                {
                    url: theURL,
                    method: "GET",
                    headers:{
                      "Content-Type" : "application/atom+xml; charset=UTF-8",
                      "User-Agent" : "Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0"
                    }
                },
                function(error, response, body) {
                    if (error) {
                        console.log("getCommunityList : error getting information for CommunityList !");
                        node.status({fill:"red",shape:"dot",text:"No CommunityList"});
                        node.error(error.toString(), theMsg);
                    } else {
                        console.log('getCommunityList: executing on ' + theURL);
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            //
                            //	Have the node to emit the URL of the newly created event
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill:"red",shape:"dot",text:"Parser Error"});
                                    node.error("Parser Error getCommunityList", theMsg);
                                    return;
                                }
                                var myData = new Array();
                                if (result.feed.entry) {
                                    //
                                    for (i=0; i < result.feed.entry.length; i++) {
                                        myData.push(parseAtomEntry(result.feed.entry[i], true));
                                    }
                                    node.status({});
                                } else {
                                    console.log('No ENTRY found for URL : ' + theURL);
                                    node.status({fill:"red",shape:"dot",text:"No Entry "});
                                }
                                theMsg.payload = myData;
                                node.send(theMsg);
                            });
                        } else {
                            console.log("GET COMMUNITY LIST  NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
                        }
                    }
                }
            ).auth(username,password); // end http.get
        }

        this.on(
            'input',
            function(msg) {
                var serverConfig = RED.nodes.getNode(config.server);
                var myURL        = "";
                var server       =  serverConfig.server;
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

                node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                switch (config.target) {
                    case "AllCommunities" :
                        myURL = server + "/communities/service/atom/communities/all?sortBy=modified&sortOrder=desc";
                        if (config.communityTag != '') {
                            myURL += "&tag=" + config.communityTag;
                        } else if ((msg.communityTag != undefined) && (msg.communityTag != '')) {
                            myURL += "&tag=" + msg.communityTag;
                        }
                        getCommunityList(msg, myURL, username, password);
                        break;
                    case "UserCommunities" :
                        myURL = server + "/communities/service/atom/communities/all?sortBy=modified&sortOrder=desc";
                        if (config.communityTag != '') {
                            myURL += "&tag=" + config.communityTag;
                        } else if ((msg.communityTag != undefined) && (msg.communityTag != '')) {
                            myURL += "&tag=" + msg.communityTag;
                        }
                        if(config.email != '') {
                            myURL += "&email=" + msg.email;
                        } else if ((msg.email != undefined) && (msg.email != '')) {
                            myURL += "&email=" + msg.email;
                        }
                        getCommunityList(msg, myURL, username, password);
                        break;
                }
            }
        );
    }

    RED.nodes.registerType("CommunitiesGet", CommunitiesGet);

    function ASGet(config) {
        RED.nodes.createNode(this,config);

        var endSlash = new RegExp("/" + "+$");
        var node     = this;
        var http     = require("request");
        var xml2js   = require("xml2js");
        var parser   = new xml2js.Parser();

        function getCommunityAS(theMsg, theURL, username, password) {
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
                        console.log("getCommunityAS : error getting information for CommunityAS !");
                        node.status({fill:"red",shape:"dot",text:"No CommunityAS"});
                        node.error(error.toString(), theMsg);
                    } else {
                        console.log('getCommunityAS: executing on ' + theURL);
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            theMsg.payload = JSON.parse(body).list;
                            node.send(theMsg);
                            node.status({});
                        } else {
                            console.log("GET COMMUNITY AS  NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
                        }
                    }
                }
            ).auth(username,password); // end http.get
        }

        this.on(
            'input',
            function(msg) {
                var serverConfig = RED.nodes.getNode(config.server);

                var myURL        = "";
                var server       =  serverConfig.server;

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
                //
                //  check the value of the communityId
                //
                var  communityId = "";
                if ((config.communityId == '') && ((msg.communityId == undefined) || (msg.communityId == ''))) {
                    //
                    //  There is an issue
                    //
                    console.log("Missing CommunityID");
                    node.status({fill:"red",shape:"dot",text:"Missing CommunityId"});
                    node.error('Missing CommunityId', theMsg);
                 } else {
                    if (config.communityId != '') {
                        communityId = config.communityId;
                    } else {
                        communityId = msg.communityId;
                    }
                    node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                    myURL = server + "/connections/opensocial/basic/rest/activitystreams/urn:lsid:lconn.ibm.com:communities.community:" + communityId + "/@all";
                    if(config.target != "All") {
                        myURL += "/"+config.target;
                    } else {
                        myURL += "/@all";
                    }
                    myURL += "?format=json&rollup=true";
                    //
                    //  Check if "Since" needs to be applied
                    //
                    if ((config.lastItemDate == '') && ((msg.lastItemDate == undefined) || (msg.lastItemDate == ''))) {
                        //
                        //  Nothing to do
                        //
                    } else {
                        var lastItemDate = "";
                        if (config.lastItemDate != '') {
                            lastItemDate = config.lastItemDate;
                        } else {
                            lastItemDate = msg.lastItemDate;
                        }
                        var isoDate = new Date(lastItemDate).toISOString();
                        myURL += "&dateFilter={'from':'" + isoDate + "','fromInclusive':false}}";
                    }
                    getCommunityAS(msg, myURL, username, password);
                 }
            }
        );
    }

    RED.nodes.registerType("ASGet", ASGet);

}
