module.exports = function(RED) {
    function ICLogin(config) {
		RED.nodes.createNode(this, config);
			
		this.server      = config.server;
		this.serverType  = config.serverType;
		this.cloudServer = config.cloudServer;
		this.username    = this.credentials.username;
		this.password    = this.credentials.password;
		
		//console.log("ICLogin.js : " + JSON.stringify(this, null, 4) +  JSON.stringify(config, null, 4));
	   
    }

    RED.nodes.registerType("ICLogin",
							ICLogin,
							{
								credentials: {
									username: {type:"text"},
									password: {type:"password"}
								}
							}
    );
}
