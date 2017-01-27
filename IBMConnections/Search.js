module.exports = function(RED) {
    function SimpleSearch(config) {
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

        function _getItemDetail(record) {
            var item = {};

            item['id'] = record.id[0];
            item['date'] = record.updated[0];
            item['title'] = record.title[0]['_'];
            item['userid'] = record.author[0]['snx:userid'][0];
            item['mail'] = record.author[0]['email'][0];
            item['name'] = record.author[0]['name'][0];
            return item;
        }

        function _goSearch(theMsg, theURL, username, password) {
             node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
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
                        console.log("error getting simple Search : " + theURL);
                        node.status({fill:"red",shape:"dot",text:error});
                        node.error('Search Error', theMsg);
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            console.log("SimpleSearch OK (" + response.statusCode + ")");
                            //console.log(body);
                            console.log(theURL);

                            //
                            //	Have the node to emit the URL of the newly created event
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill:"red",shape:"dot",text:err});
                                    node.error("Parser Error SimpleSearch", theMsg);
                                    return;
                                }
                                if (result.feed.entry) {
                                    //
                                    var myData = new Array();
                                    for (i=0; i < result.feed.entry.length; i++) {
                                        myData.push(_getItemDetail(result.feed.entry[i]));
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
                            console.log("SimpleSearch NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
                        }
                    }
                }
            ).auth(username,password); // end http.post
        }

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

                myURL = server + '/search/atom/mysearch';
                if ((config.query == '') && ((msg.query == undefined) || (msg.query == ''))) {
                    //
                    //  There is an issue
                    //
                    console.log("Missing Query Information");
                    node.status({fill:"red",shape:"dot",text:"Missing Query"});
                    node.error('Missing Query', theMsg);
                 } else {
                    var query = '';
                    if (config.query != '') {
                        query = config.query;
                    } else {
                        query = msg.query;
                    }
                    myURL += '?query="' + encodeURIComponent(query) + '"';

                     console.log(query);
                     console.log(myURL);
                    //
                    // Add the scope
                    //
                    myURL += "&scope=" + config.theScope;
                    //
                    //  Add the Sort
                    //
                    myURL += "&sortKey=" + config.sortKey + "&sortOrder=" + config.sortOrder;
                    //
                    //  Force PageSize and PersonalContentBoost
                    //
                    myURL += '&ps=1000&personalization={"type":"personalContentBoost","value":"on"}';
                    //
                    //  Now we have the query and we can deliver it
                    //
                    _goSearch(msg, myURL, username, password);
                }
             }
        );
    }

    RED.nodes.registerType("SimpleSearch",  SimpleSearch);

}
