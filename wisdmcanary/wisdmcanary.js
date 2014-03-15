require('wisdmjs:/3rdparty/base64/base64.js');
require('wisdmjs:/3rdparty/zlib/zlib.inflate.js');
require('wisdmjs:/utils.js');
require('wisdmjs:/3rdparty/md5/md5.js');

/*
******************* wisdmcanary.js **********************

WISDM API for web browsers
Copyright 2012-2014 by Jeremy Magland

The public API part of this file is documented.

***********************************************************
*/

// The "Wisdm" object contains all of the API functions
Wisdm={};
Wisdm.currentUser=''; //the current user
Wisdm.currentUserDomain=''; //the current user domain
Wisdm.sessionNode=''; //the current node
Wisdm.session_id='';
Wisdm.max_upload_MB=5; //the maximum size of an upload file -- this can be configured

///////////////////////////////
var s_getFileData_memory_cache={};
var s_checksum_memory={};
var s_pending_checksums={};

//for compatibility with old system
Wisdm.currentStudy=''; //no longer used!
Wisdm.sessionHost=''; //no longer used!
Wisdm.sessionPort=''; //no longer used!
Wisdm.userStudyPrivileges=[]; //no longer used!

//Session Stats
Wisdm.sessionStats={
	numRequests:0,
	numRequestGroups:0,
	bytesReceived:0,
	bytesSent:0,
	requestCounts:{}
};
Wisdm.formatSessionStats=function() {
	var XX=Wisdm.sessionStats;
	var txt='';
	txt+=XX.numRequests+' requests\t'+XX.numRequestGroups+' request groups\n';
	txt+=(XX.bytesSent/1000)+' kb sent\t'+(XX.bytesReceived/1000)+' kb received\n';
	for (var reqname in XX.requestCounts) {
		txt+=XX.requestCounts[reqname][0]+' requests\t'+(XX.requestCounts[reqname][1]/1000)+' kb sent\t'+(XX.requestCounts[reqname][2]/1000)+' kb received\t'+(XX.requestCounts[reqname][3]/1000)+' seconds\t'+' for '+reqname+'\n';
	}
	return txt;
};

//Warnings and error messages
/*
The following functions can be replace to handle alert messages and access warnings in a custom way. 
By default, these messages are displayed in the console.
For example you could do the following:
	Wisdm.alert=function(msg) {console.log ('Custom ALERT: '+msg);}
*/
Wisdm.alert=function(msg) {console.log ('ALERT: '+msg); Wisdm.handle_alert(msg);}; //this function can be replaced to handle alert messages coming from the WISDMCANARY system
Wisdm.onAccessWarning=function(msg) {Wisdm.alert(msg);}; //this function can be replaced to handle access warnings (e.g. the current user does not have permission to access a file)
if (typeof(console)=='undefined') {console={}; console.log=function() {};} //make sure that console.log is defined
function disp (a,b,c,d) { //a synonym for convenience
	if (typeof(b)=='undefined') console.log (a);
	else if (typeof(c)=='undefined') console.log (a,b);
	else if (typeof(d)=='undefined') console.log (a,b,c);
	else console.log (a,b,c,d);
}
Wisdm.handled_session_disconnected=false;
Wisdm.handle_alert=function(msg) {
	if (msg.indexOf('Directory does not exist for session:')===0) {
		if (!Wisdm.handled_session_disconnected) {
			Wisdm.handled_session_disconnected=true;
			jConfirm('Your WISDM session has been disconnected. Would you like to reload the page?','Session lost',function(tmp) {
				if (tmp===true) {
					window.location=''; //not sure if this works on all browsers.... need to test
				}
			});
		}
	}
	else if (msg.indexOf('Unable to connect to waiting wisdmcanary process:')===0) {
		jAlert(msg);
	}
	else if (msg.indexOf('Unexpected problem')===0) {
		jAlert(msg);
	}
};

Wisdm.onSessionOpened=function(callback) {Wisdm.onSessionOpened_handlers.push(callback);};
Wisdm.onUserChanged=function(callback) {Wisdm.onUserChanged_handlers.push(callback);};
Wisdm.onStudyChanged=function(callback) {console.log ('warning: Wisdm.onStudyChanged is obsolete');};

//retrieve a query parameter from the url
Wisdm.queryParameter=function(name,defaultval) {
	if (typeof(defaultval)=='undefined') defaultval='';
	name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
	var regexS = "[\\?&]" + name + "=([^&#]*)";
	var regex = new RegExp(regexS);
	var results = regex.exec(window.location.search);
	if(results === null)
		return defaultval;
	else
		return decodeURIComponent(results[1].replace(/\+/g, " "));
};

Wisdm.getCookie=function(c_name,default_val) {
	var i,x,y,ARRcookies=document.cookie.split(";");
	for (i=0;i<ARRcookies.length;i++) {
		x=ARRcookies[i].substr(0,ARRcookies[i].indexOf("="));
		y=ARRcookies[i].substr(ARRcookies[i].indexOf("=")+1);
		x=x.replace(/^\s+|\s+$/g,"");
		if (x==c_name) {
			return unescape(y);
		}
	}
	return default_val;
};

Wisdm.setCookie=function(c_name,val) {
	var exdays=1;
  var exdate=new Date();
	exdate.setDate(exdate.getDate() + exdays);
	var c_value=escape(val) + ((exdays===null) ? "" : ";path=/;expires="+exdate.toUTCString());
	document.cookie=c_name + "=" + c_value;
};



/*
The following API functions all have the same format:
	Wisdm.name_of_function=function(params,callback) {
		//internal code...
	}
The params is a structure containing the input parameters.
The callback is a function (provided by the user) to be executed when the command completes.
The callback function will take a single parameter, a structure of returned data.

For example, to open a session:
	Wisdm.openSession({node:'DEFAULT'},function(tmp1) {
		console.log ('Session ID: '+tmp1.session_id); //this is the unique session id if the session was opened successfully.
	});

Each function is documented in terms of its inputs and outputs. It should be understood that the inputs are fields of the 
params variable and the outputs are fields of the data variable in the callback function.
*/

/*
~~~ Wisdm.openSession ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT:
	node: the name of the node (e.g. 'DEFAULT')
OUTPUT:
	session_id: the unique id for the session if opened successfully. This id is used internally.
DESCRIPTION:
	Opens a new session. You should wait for the callback before performing any additional
	Wisdm commands.
EXAMPLE:
	Wisdm.openSession({node:'DEFAULT'},function(tmp1) {
		console.log ('Session ID: '+tmp1.session_id);
	});
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.openSession=function(params,callback) {
	if (!('node' in params)) params.node='';
	
	var req0={command:'openSession'};
	req0.node=params.node;
	Wisdm.makeRequest(req0,function(tmp) {
		Wisdm.session_id=tmp.session_id;
		Wisdm.currentUser='';
		Wisdm.currentUserDomain='';
		s_getFileData_memory_cache={};
		s_checksum_memory={};
		s_pending_checksums={};
		
		Wisdm.on_user_changed(Wisdm.currentUser,Wisdm.currentUserDomain);
		if (tmp.session_id.length>0) {
			Wisdm.sessionNode=params.node;
			Wisdm.on_session_opened();
			
			var id_info=Wisdm._get_identity_info();
			if (id_info.identity_certificate_id) {
				Wisdm.setCurrentUser({user:id_info.user,user_domain:id_info.user_domain,identity_certificate_id:id_info.identity_certificate_id},function(tmp8) {
					if (callback) callback(tmp);
				});
			}
			else {
				if (callback) callback(tmp);
			}
		}
		else {
			if (callback) callback(tmp);
		}
		Wisdm.send_empty_request();
	});
};

/*
~~~ Wisdm.setSuperSessionUser ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT:
OUTPUT:
	success: 'true' or 'false' depending on the success of the authentication
	user: the current user name
DESCRIPTION:
	Sets the current user according to the supersession.
EXAMPLE:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.setSuperSessionUser=function(params,callback) {
	console.log ('WARNING: Wisdm.setSuperSessionUser has been removed.');
	
	if (callback) callback({success:'true',error:'setSuperSessionUser has been removed'});
	
	/*
	var req0={name:'setSuperSessionUser',_report_error:false};
	Wisdm.makeRequest(req0,function(tmp) {
		if (tmp.success=="true") {
			if ('user' in tmp) {
				if (Wisdm.currentUser!=tmp.user) {			
					Wisdm.currentUser=tmp.user;
					Wisdm.on_user_changed(tmp.user);
				}
			}
		}
		if (callback) callback(tmp);
	});
	*/
	
};


/*
~~~ Wisdm.setCurrentUser ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT:
	user: the user name -- or empty to log out
	password: the password
	user_domain:
OUTPUT:
	success: true or false depending on the success of the authentication
DESCRIPTION:
	Sets the current user
EXAMPLE:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.setCurrentUser=function(params,callback) {
	
	/*
	var req0={name:'setCurrentUser'};
	if (typeof(params.user)!=='string') {
		console.log ('Warning: params.user is undefined in setCurrentUser!');
		if (callback) callback({success:'false',error:'user is undefined.'});
		return;
	}
	req0.user=params.user;
	req0.password=params.password;
	Wisdm.makeRequest(req0,function(tmp) {
		if (tmp.success=="true") {
			if (Wisdm.currentUser!=req0.user) {
				Wisdm.currentUser=req0.user;
				Wisdm.on_user_changed(req0.user);
			}
		}
		if (callback) callback(tmp);
	});
	*/
	
	if (typeof(params.user)!=='string') {
		console.log ('Warning: params.user is undefined in setCurrentUser!');
		if (callback) callback({success:'false',error:'user is undefined.'});
		return;
	}
	
	//handle the log-out case first
	if (params.user==='') {
		var req0={name:'setCurrentUser'};
		req0.user='';
		req0.user_domain='';
		Wisdm.makeRequest(req0,function(tmp2) {
			if (tmp2.success=="true") {
				if ((Wisdm.currentUser!=req0.user)||(Wisdm.currentUserDomain!=req0.user_domain)) {
					Wisdm.currentUser=req0.user;
					Wisdm.currentUserDomain=req0.user_domain;
					Wisdm.on_user_changed(req0.user,req0.user_domain);
				}
				Wisdm._set_identity_info({});
			}
			else console.log (tmp2.error);
			if (callback) callback(tmp2);
		});
		return;
	}
	
	
	//set the default user_domain
	params.user_domain=params.user_domain||location.hostname;
	
	//if password was not specified, then we are attempting to use an active certificate
	if ((params.password||'')==='') {
		var id_info=Wisdm._get_identity_info();
		if ((id_info.user==params.user)&&(id_info.user_domain==params.user_domain)) {
			var req0={name:'setCurrentUser'};
			req0.user=params.user;
			req0.user_domain=params.user_domain;
			req0.identity_certificate_id=id_info.identity_certificate_id||'';
			Wisdm.makeRequest(req0,function(tmp5) {
				if (tmp5.success=="true") {
					console.log ('accepted.');
					if ((Wisdm.currentUser!=req0.user)||(Wisdm.currentUserDomain!=req0.user_domain)) {
						Wisdm.currentUser=req0.user;
						Wisdm.currentUserDomain=req0.user_domain;
						Wisdm.on_user_changed(req0.user,req0.user_domain);
					}
				}
				else console.log (tmp5.error);
				if (callback) callback(tmp5);
			});
		}
		else {
			if (callback) callback({success:'false',error:'user or user_domain does not match current identity info'});
		}
		return;
	}
	
	//get authenticatication certificate
	var auth_url='';
	var user_domain=params.user_domain;
	if (user_domain=='localhost') {
		auth_url='http://localhost/cgi-bin/wisdmauthcgi';
	}
	else if (user_domain=='realhub.org') {
		auth_url='http://realhub.org/cgi-bin/wisdmauthcgi';
	}
	else {
		if (callback) callback({success:'false',error:'unrecognized user_domain: '+user_domain});
		return;
	}
	
	console.log('authenticating...');
	$.post(
		auth_url,
		JSON.stringify({command:'authenticate',user:params.user,user_domain:user_domain,password:params.password}),
		set_user_step2,
		'json'
	);
	
	function set_user_step2(tmp) {
		if ((tmp.success)&&(tmp.success=='true')) {
			console.log ('submitting identity certificate...');
			var req0={name:'setCurrentUser'};
			req0.user=params.user;
			req0.user_domain=params.user_domain;
			req0.identity_certificate=JSON.stringify(tmp);
			var certificate_id=tmp.certificate_id;
			Wisdm.makeRequest(req0,function(tmp2) {
				if (tmp2.success=="true") {
					console.log ('accepted.');
					if ((Wisdm.currentUser!=req0.user)||(Wisdm.currentUserDomain!=req0.user_domain)) {
						Wisdm.currentUser=req0.user;
						Wisdm.currentUserDomain=req0.user_domain;
						Wisdm.on_user_changed(req0.user,req0.user_domain)
					}
					Wisdm._set_identity_info({user:req0.user,user_domain:req0.user_domain,identity_certificate_id:certificate_id});
				}
				else console.log (tmp2.error);
				if (callback) callback(tmp2);
			});
		}
		else {
			console.log (tmp.error);
			if (callback) callback({success:'false',error:'Problem authenticating: '+tmp.error});
		}
	}
	
};




/*
~~~ Wisdm.fileSystemCommand~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT:
	command:
	working_path: e.g. data:/path/to/data
OUTPUT:
	[variable]
DESCRIPTION:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.fileSystemCommand=function(params,callback) {
	var req0={_name:'fileSystemCommand'};
	req0.command=params.command;
	req0.working_path=params.working_path;
	Wisdm.makeRequest(req0,function(tmp1) {
		if ((req0.command=='cp')||(req0.command=='mv')||(req0.command=='rm')) {
			Wisdm.resetFileChecksums();
		}
		if (callback) callback(tmp1);
	});
};

/*
~~~ Wisdm.getFileChecksum ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT:
	path: e.g. data:/path/to/data
OUTPUT:
	checksum
DESCRIPTION:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.resetFileChecksums=function() {
	s_checksum_memory={};
	s_pending_checksums={};
};
var reset_file_checksums_timer=function() {
	Wisdm.resetFileChecksums();
	setTimeout(reset_file_checksums_timer,5000);
};
setTimeout(reset_file_checksums_timer,5000);
Wisdm.getFileChecksum=function(params,callback) {
	var path0=params.path||'';
	if (path0 in s_checksum_memory) {
		callback({success:'true',checksum:s_checksum_memory[path0]});
		return;
	}
	if (path0 in s_pending_checksums) {
		var elapsed0=(new Date())-s_pending_checksums[path0];
		if (elapsed0<2000) {
			setTimeout(function() {
				Wisdm.getFileChecksum(params,callback);
			},10);
			return;
		}
	}
	s_pending_checksums[path0]=new Date();
	var req0={_name:'getFileChecksum'};
	req0.path=path0;
	Wisdm.makeRequest(req0,function(tmp) {
		if (tmp.success=='true') {
			s_checksum_memory[path0]=tmp.checksum;
			delete s_pending_checksums[path0];
			callback({success:'true',checksum:tmp.checksum});
		}
		else {
			callback(tmp);
		}
	});
};

/*
~~~ Wisdm.getFileData~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT:
	path: e.g. data:/path/to/data
	bytes: (optional) e.g. 0:100,110:130,300:10:400
	compression: (optional) e.g. 'zlib'
	mode: (optional) default is 'binary', alternative='text'
	use_memory_cache: (optional) 'true'
OUTPUT:
	data: binary data (or text if mode='text')
DESCRIPTION:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.getFileData=function(params,callback) {
	var timer0=new Date();
	var code0=JSON.stringify(params);
	if ((params.use_memory_cache||'')=='true') {
		if (code0 in s_getFileData_memory_cache) {
			callback(s_getFileData_memory_cache[code0]);
			return;
		}
	}
	var elapsed_checksum_time='';
	Wisdm.getFileChecksum({path:params.path},function(tmp05) {
		elapsed_checksum_time=(new Date())-timer0;
		if (tmp05.success=='true') {
			if ((tmp05.checksum||'')==='') {
				callback({success:'true',data:''});
				return;
			}
			
			var bytes0=params.bytes||'';
			var compression0=params.compression||'';
			var cache_signature='fd_'+md5(tmp05.checksum+'--'+bytes0+'--'+compression0);
			
			var cache_url='$approot$/../../../wisdmcache/'+cache_signature+'.dat';
			GetBase64File(cache_url,function(tmpA) {
				if (tmpA.success) {
					handle_response({success:'true',data:tmpA.Content});
				}
				else {
					var req0={name:'getFileData'};
					req0.path=params.path;
					req0.bytes=bytes0;
					req0.compression=compression0;
					req0.cache_signature=cache_signature;
					console.log('sending request for getFileData...',req0);
					Wisdm.makeRequest(req0,function(tmpB) {
						console.log(tmpB);
						if (tmpB.success=='true') {
							if ((tmpB['data-is-empty']||'')=='true') {
								handle_response({success:'true',data:[]});
							}
							else {
								GetBase64File(cache_url,function(tmpC) {
									if (tmpC.success) {
										handle_response({success:'true',data:tmpC.Content});
									}
									else {
										callback({success:'false',error:'Unexpected error getting cache file: '+tmpC.error});
									}
								});
							}
						}
						else {
							callback({success:'false',error:tmpB.error});
						}
					});
				}
			});
		}
		else {
			callback({success:'false',error:'Error getting checksum: '+tmp05.error});
		}
		function handle_response(tmp) {
			if (tmp.success=='true') {
				if (compression0=='zlib') {
					try {
						tmp.data=(new Zlib.Inflate(tmp.data)).decompress();
					}
					catch(err) {
						disp('Problem decompressing: '+err,'getFileData',params.path,params);
						tmp.data=[];
					}
				}
				if (params.mode=='text') {
					var str='';
					for (var i=0; i<tmp.data.byteLength; i++) {
							str+=String.fromCharCode(tmp.data[i]);
					}
					tmp.data=str;
				}
				if (callback) {
					if ((params.use_memory_cache||'')=='true') {
						s_getFileData_memory_cache[code0]=tmp;
					}
					tmp.elapsed_total_time=(new Date())-timer0;
					tmp.elapsed_checksum_time=elapsed_checksum_time;
					callback(tmp);
				}
			}
			else {
				if (callback) callback(tmp);
			}
		}
	});
};

/*
~~~ Wisdm.setFileData~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT:
	path: e.g. data:/path/to/data
	data: the binary data
OUTPUT:
DESCRIPTION:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.setFileData=function(params,callback) {
	var req0={name:'setFileData'};
	req0.path=params.path;
	req0.data=params.data;
	
	if (typeof(req0.data||'')!='string') {
		req0.data=base64ArrayBuffer(req0.data);
		req0.base64='true';
	}
	
	var CHUNK_SIZE=1*1000*1000;
	if (req0.data.length<=CHUNK_SIZE) {
		Wisdm.makeRequest(req0,function(tmp1) {
			Wisdm.resetFileChecksums();
			callback(tmp1);
		});
	}
	else {
		var upload_id=makeRandomId(6);
		set_next_chunk(0);
		function set_next_chunk(byte_index) {
			console.log ('setting chunk: '+byte_index);
			var req1={name:'setFileDataChunk'};
			req1.path=params.path;
			req1.base64=req0.base64||'false';
			req1.upload_id=upload_id;
			if (req0.data.length<=byte_index+CHUNK_SIZE) {
				//last chunk
				req1.data=req0.data.slice(byte_index);
				req1.final='true';
				Wisdm.makeRequest(req1,function(tmp2) {
					callback(tmp2);
				});
			}
			else {
				req1.data=req0.data.slice(byte_index,byte_index+CHUNK_SIZE);
				req1.final='false';
				Wisdm.makeRequest(req1,function(tmp2) {
					if (tmp2.success=='true') {
						if (params.on_progress) {
							params.on_progress(byte_index+CHUNK_SIZE,req0.data.length);
						}
						set_next_chunk(byte_index+CHUNK_SIZE);
					}
					else {
						callback(tmp2);
					}
				});
			}
		}
	}
};

/*
~~~ Wisdm.submitScript~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT:
	script: the script text (optional)
	dependency_scripts: the dependent scripts (optional)
	script_file_path (or path): (optional)
	run_parameters (or parameters): (optional object)
OUTPUT:
	output_messages
DESCRIPTION:
	Submits a processing script
EXAMPLE:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.submitScript=function(params,callback) {
	//if (Wisdm.currentUser!=='magland') {
	//	Wisdm.adminMessage({subject:'submitScript',message:{user:Wisdm.currentUser,node:Wisdm.sessionNode,path:params.script_file_path}});
	//}
	var req0={name:'submitScript'};
	req0.script=params.script||'';
	req0.dependency_scripts=JSON.stringify(params.dependency_scripts||{});
	req0.script_file_path=params.script_file_path||params.path||'';
	if ((req0.script_file_path)&&(req0.script_file_path.indexOf('data:')!==0)&&(req0.script_file_path.indexOf('http:')!==0)&&(req0.script_file_path.indexOf('https:')!==0)) {
			req0.script_file_path=location.origin+'/'+location.pathname+'/'+req0.script_file_path;
	}
	req0.run_parameters=JSON.stringify(params.run_parameters||params.parameters||{});
	Wisdm.makeRequest(req0,function(tmp) {
		if (callback) {
			if (tmp.success=='true') {
				var script_id=tmp.script_id;
				var do_check=function() {
					Wisdm.resetFileChecksums();
					var req1={name:'getScriptStatus',script_id:script_id};
					Wisdm.makeRequest(req1,function(tmp2) {
						if (tmp2.success=='true') {
							if (tmp2.done=='true') {
								tmp2.script_id=tmp.script_id;
								callback(tmp2);
							}
							else {
								setTimeout(do_check,2000);
							}
						}
						else {
							tmp2.script_id=script_id;
							callback(tmp2);
						}
					});
				};
				do_check();
			}
			else {
				callback(tmp);
			}
		}
	});
};

/*
~~~ Wisdm.checkOutputReady~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT:
	path or paths:
OUTPUT:
	ready: 'true' or 'false'
DESCRIPTION:
EXAMPLE:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.checkOutputReady=function(params,callback) {
	var req0={name:'checkOutputReady'};
	req0.path=params.path||'';
	Wisdm.makeRequest(req0,callback);
};
Wisdm.waitForOutput=function(params,callback) {
	Wisdm.resetFileChecksums(); //this is important because this function may be called very shortly after a file has changed
	console.log('waitForOutput',params);
	var timer00=new Date();
	var timeout=params.timeout||240000;
	if (params.paths) {
		//handle case of multiple paths (recursively)
		if (params.paths.length===0) {
			if (callback) callback({success:'true',ready:'true'});
		}
		else {
			var params2=JSON.parse(JSON.stringify(params));
			params2.path=params.paths[0];
			params2.paths=null;
			Wisdm.waitForOutput(params2,function(tmp) {
				if (tmp.ready=='true') {
						var elapsed00=(new Date())-timer00;
						var params3=JSON.parse(JSON.stringify(params));
						params3.paths=params.paths.slice(1);
						params3.timeout=timeout-elapsed00;
						Wisdm.waitForOutput(params3,callback);
				}
				else {
					if (callback) callback(tmp);
				}
			});
		}
		return;
	}
	
	var path=params.path||'';

	function do_check() {
		console.log('do_check...');
		var elapsed00=(new Date())-timer00;
		if (elapsed00>=timeout) {
			callback({success:'true',ready:'false'});
		}
		else {
			console.log('checking output ready: '+path);
			Wisdm.checkOutputReady({path:path},function(tmp1) {
				console.log(tmp1);
				if ((tmp1.ready||'false')=='true') {
					callback({success:'true',ready:'true'});
				}
				else {
					setTimeout(do_check,1000);
				}
			});
		}
	}
	do_check();
};


/*
~~~ Wisdm.cleanupScriptProcesses~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT:
	script_id: the id of the script
OUTPUT:
DESCRIPTION:
EXAMPLE:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.cleanupScriptProcesses=function(params,callback) {
	var req0={name:'cleanupScriptProcesses'};
	req0.script_id=params.script_id||'';
	Wisdm.makeRequest(req0,callback);
};

/*
~~~ Wisdm.clearRunningProcesses~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT:
OUTPUT:
DESCRIPTION:
EXAMPLE:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.clearRunningProcesses=function(params,callback) {
	var req0={name:'clearRunningProcesses'};
	Wisdm.makeRequest(req0,callback);
};
Wisdm.clearRunningProcesses2=Wisdm.clearRunningProcesses;

/*
~~~ Wisdm.clearQueuedProcesses~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT:
OUTPUT:
DESCRIPTION:
EXAMPLE:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.clearQueuedProcesses=function(params,callback) {
	var req0={name:'clearQueuedProcesses'};
	Wisdm.makeRequest(req0,callback);
};
Wisdm.clearQueuedProcesses2=Wisdm.clearQueuedProcesses;

/*
~~~ Wisdm.clearPendingProcesses~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT:
OUTPUT:
DESCRIPTION:
EXAMPLE:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.clearPendingProcesses=function(params,callback) {
	var req0={name:'clearPendingProcesses'};
	Wisdm.makeRequest(req0,callback);
};
Wisdm.clearPendingProcesses2=Wisdm.clearPendingProcesses;


/*
~~~ Wisdm.clearErrorProcesses~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT:
OUTPUT:
DESCRIPTION:
EXAMPLE:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.clearErrorProcesses=function(params,callback) {
	var req0={name:'clearErrorProcesses'};
	Wisdm.makeRequest(req0,callback);
};
Wisdm.clearErrorProcesses2=Wisdm.clearErrorProcesses;



/*
~~~ Wisdm.getProcessSummary~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT:
OUTPUT:
	[variable]
DESCRIPTION:
EXAMPLE:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.getProcessSummary=function(params,callback) {
	var req0={name:'getProcessSummary'};
	Wisdm.makeRequest(req0,callback);
};

/*
~~~ Wisdm.updateCommonCode~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT:
OUTPUT:
DESCRIPTION:
EXAMPLE:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.updateCommonCode=function(params,callback) {
	var req0={name:'updateCommonCode'};
	Wisdm.makeRequest(req0,callback);
};

/*
~~~ Wisdm.adminCommand~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT: 
	command, e.g. setuserpassword testuser password
OUTPUT:
	output
DESCRIPTION:
(must be logged in as admin)
EXAMPLE:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.adminCommand=function(params,callback) {
	var req0={name:'adminCommand'};
	req0.command=params.command||'';
	Wisdm.makeRequest(req0,callback);
};

/*
~~~ Wisdm.restartNode~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT: 
	command, e.g. setuserpassword testuser password
OUTPUT:
	output
DESCRIPTION:
(must be logged in as admin)
EXAMPLE:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.restartNode=function(params,callback) {
	var req0={name:'restartNode'};
	Wisdm.makeRequest(req0,callback);
};

/*
~~~ Wisdm.getNodeStats~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT: 
OUTPUT:
	connections
DESCRIPTION:
(must be logged in as admin)
EXAMPLE:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.getNodeStats=function(params,callback) {
	var req0={name:'getNodeStats'};
	Wisdm.makeRequest(req0,callback);
};

/*
~~~ Wisdm.createApp~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT: 
	path: path to html file
OUTPUT:
DESCRIPTION:
(must be logged in)
EXAMPLE:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.createApp=function(params,callback) {
	var req0={name:'createApp'};
	req0.path=params.path||'';
	Wisdm.makeRequest(req0,callback);
};

/*
~~~ Wisdm.getAllUsers~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
INPUT: 
OUTPUT:
	users: a list of all users for this node
DESCRIPTION:
EXAMPLE:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
Wisdm.getAllUsers=function(params,callback) {
	var req0={name:'getAllUsers'};
	Wisdm.makeRequest(req0,callback);
};


//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////// INTERNAL ////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////

Wisdm.onUserChanged_handlers=[];
Wisdm.on_user_changed=function(user0,user_domain0) {
	for (var ii=0; ii<Wisdm.onUserChanged_handlers.length; ii++) {
		if ($.isFunction(Wisdm.onUserChanged_handlers[ii])) {
			(Wisdm.onUserChanged_handlers[ii])(user0,user_domain0);
		}
		else {
			console.log ('Warning... handler for on_user_changed is not a function.');
		}
	}
};


Wisdm.onSessionOpened_handlers=[];
Wisdm.on_session_opened=function() {
	for (var ii=0; ii<Wisdm.onSessionOpened_handlers.length; ii++) {
		if ($.isFunction(Wisdm.onSessionOpened_handlers[ii])) {
			(Wisdm.onSessionOpened_handlers[ii])();
		}
		else {
			console.log ('Warning... handler for on_session_changed is not a function.');
		}
	}
};



/*
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
internal stuff is below
The following code is internal and undocumented
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

Wisdm.callbacks={};
Wisdm.callback_code=1; //this is a counter so we can identify which callback to call
Wisdm.server_ip=location.host; //not sure if this is cross-browser compatible
Wisdm.request_index=1;
Wisdm.session_id='';

//Sending requests
Wisdm.makeRequest=function(req0,callback_function) {
	if (req0.command!='openSession') {
		/*if (Wisdm.session_id==='') {
			console.log ('Session id is empty for request: '+req0.name);
			callback_function({success:false,error:'Session id is empty for request.'});
			return;
		}*/
	}
	if ((!req0._name)&&(req0.name)) {
		req0._name=req0.name;
		delete req0.name;
	}
	req0._request_index=Wisdm.request_index;
	Wisdm.request_index++;
	req0._session=Wisdm.session_id;
	//req0._supersession_id=get_supersession_id();
	req0._rand=makeRandomId();
	Wisdm.queued_requests.push({req:req0,callback:callback_function});
};
Wisdm.queued_requests=[];
Wisdm.num_outstanding_requests=0;
Wisdm.timers={};
Wisdm.timers1={};
Wisdm.timers2={};
Wisdm.timers3={};
Wisdm.counts={};
Wisdm.send_queued_requests=function() {
	if (Wisdm.queued_requests.length===0) { //if there are no requests to send
		setTimeout(Wisdm.send_queued_requests,30); //come back in 30 ms to check for new requests
		return;
	}
	
	var max_requests_to_send=10;
	if (max_requests_to_send<=0) {
		setTimeout(Wisdm.send_queued_requests,30); //come back in 30 ms to check for new requests
		return;
	}
	var requests_to_send=[];	
	var last_error_report=0;
	while ((Wisdm.queued_requests.length>0)&&(requests_to_send.length<max_requests_to_send)) {
		(function() {
			//we will send the first queued request
			var req0=Wisdm.queued_requests[0].req;
			var callback_function=Wisdm.queued_requests[0].callback;
			Wisdm.queued_requests.splice(0,1); //remove it from the list
			var date0=new Date();
			if (!('name' in req0)) req0.name=req0.command;
	
			var full_callback_function=function(tmp00) {
				var num_bytes0=JSON.stringify(tmp00).length;
				if (('name' in req0)&&(req0.name in Wisdm.sessionStats.requestCounts)) {
					Wisdm.sessionStats.requestCounts[req0.name][2]+=num_bytes0;
					Wisdm.sessionStats.requestCounts[req0.name][3]+=(new Date())-date0;
				}
				Wisdm.sessionStats.bytesReceived+=num_bytes0;
				Wisdm.num_outstanding_requests--;
				if ((callback_function!==undefined)&&(callback_function!==null)) {
					if (('success' in tmp00)&&(tmp00.success=='false')) {
						var elapsed0=((new Date())-last_error_report);
						if (elapsed0>2000) {
							last_error_report=new Date();
							var report_it=true;
							if (req0._report_error===false) report_it=false;
							if (report_it) {
								jAlert('Warning: Error in '+req0.name+': '+tmp00.error);
								if (req0.password) req0.password='*****';
								console.log ('ERROR REPORT:::::: ',req0,tmp00);
							}
						}
					}
					callback_function(tmp00);
				}
				if (!(req0.name in Wisdm.timers)) {
					Wisdm.timers[req0.name]=0;
					Wisdm.timers1[req0.name]=0;
					Wisdm.timers2[req0.name]=0;
					Wisdm.timers3[req0.name]=0;
					Wisdm.counts[req0.name]=0;
				}
				Wisdm.timers[req0.name]+=(new Date())-date0;
				if ('time1' in tmp00) Wisdm.timers1[req0.name]+=Number(tmp00.time1);
				if ('time2' in tmp00) Wisdm.timers2[req0.name]+=Number(tmp00.time2);
				if ('time3' in tmp00) Wisdm.timers3[req0.name]+=Number(tmp00.time3);
				Wisdm.counts[req0.name]++;
			};
			
			Wisdm.callbacks[Wisdm.callback_code]=full_callback_function;
			/*if ((!(callback_function===undefined))&&(callback_function!=null)) {
				Wisdm.callbacks[Wisdm.callback_code]=callback_function;
			}	
			else {
				Wisdm.callbacks[Wisdm.callback_code]=function() {};
			}*/
			req0._callback_code=Wisdm.callback_code;
			Wisdm.callback_code++;
			
			requests_to_send.push(req0);
		})();
	}
	
	var send_url=function(url) {
		var head= document.getElementsByTagName('head')[0];
		var script=document.createElement('script');
		script.type= 'text/javascript';
		script.src=url;
		head.appendChild(script);
	
		if (Wisdm.queued_requests.length>0) {
			//setTimeout(Wisdm.send_queued_requests,10);
			Wisdm.send_queued_requests(); //send more requests immediately
		}
		else {
			setTimeout(Wisdm.send_queued_requests,100); //come back in 100 ms
		}
	};
	
	var querystr0='';
	for (var ii=0; ii<requests_to_send.length; ii++) {
		var req0=$.extend({},requests_to_send[ii]); //clone
		//remove the empty fields to save data length in the stringified object
		for (var field0 in req0) if (req0[field0]==='') delete(req0[field0]);
		var querystr=escape(JSON.stringify(req0));
		if (querystr0.length>0) querystr0+='~~W~W'+'~~'; //this is very tricky -- we use a special separator, and we need to make sure it does not appear in any request! (it's a hack)
		querystr0+=querystr;
		Wisdm.num_outstanding_requests++;
		Wisdm.sessionStats.numRequests++;
		if ('name' in req0) {
			if (!(req0.name in Wisdm.sessionStats.requestCounts)) Wisdm.sessionStats.requestCounts[req0.name]=[0,0,0,0];
			Wisdm.sessionStats.requestCounts[req0.name][0]++;
			Wisdm.sessionStats.requestCounts[req0.name][1]+=querystr.length;
		}
	}
	Wisdm.sessionStats.numRequestGroups++;
	Wisdm.sessionStats.bytesSent+=querystr0.length;
	if ('WisdmDesktop' in window) {
		window.WisdmDesktop.send_query(querystr0);
		Wisdm.send_queued_requests();
	}
	else {
		if (querystr0.length>500) {
			var large_query_id=makeRandomId();
			var url='http://'+Wisdm.server_ip+'/cgi-bin/wisdmcanarycgi?large_query_id='+large_query_id;
			$.post('http://'+Wisdm.server_ip+'/cgi-bin/wisdmcanarycgi','large_query_id='+large_query_id+'&large_query_string='+querystr0,function() {
				send_url(url);
			});
		}
		else {
			//just send with a get
			var url2='http://'+Wisdm.server_ip+'/cgi-bin/wisdmcanarycgi?'+querystr0;
			send_url(url2);
		}
	}
	
};
Wisdm.send_queued_requests();

/*
var get_supersession_id=function() {
	var tmp=Wisdm.getCookie('wisdm_supersession_id','');
	if ((tmp==='')||(tmp===null)) {
		tmp=makeRandomId();
		Wisdm.setCookie('wisdm_supersession_id',tmp);
	}
	return tmp;
};
*/

Wisdm._get_identity_info=function() {
	var tmp=Wisdm.getCookie('wisdm_identity_info','');
	if ((tmp==='')||(tmp===null)) {
		tmp='{}';
	}
	try {
		return JSON.parse(tmp);
	}
	catch(err) {
		return {};
	}
};
Wisdm._set_identity_info=function(info) {
	var old_info=Wisdm._get_identity_info();
	if (old_info.identity_certificate_id) {
		if (Wisdm.session_id) {
			Wisdm.makeRequest({
				name:'closeIdentityCertificate',
				certificate_id:old_info.identity_certificate_id,
				_report_error:false
			},function(tmp0) {
			});
		}
	}
	Wisdm.setCookie('wisdm_identity_info',JSON.stringify(info));
};


var makeRandomId=function(numchars)
{
	if (!numchars) numchars=10;
	
	var text = "";
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	
	for( var i=0; i < numchars; i++ ) text += possible.charAt(Math.floor(Math.random() * possible.length));
	
	return text;
};

/*
Wisdm.createRequestUrl=function(req0,callback) {
	var querystr=escape(JSON.stringify(req0));
	var url='';
	if (querystr.length>500) {
		var large_query_id=makeRandomId();
		$.post('http://'+Wisdm.server_ip+'/cgi-bin/wisdmcanarycgi','large_query_id='+large_query_id+'&large_query_string='+querystr,callback);
		url='http://'+Wisdm.server_ip+'/cgi-bin/wisdmcanarycgi?large_query_id='+large_query_id;
	}
	else {
		//just send with a get
		url='http://'+Wisdm.server_ip+'/cgi-bin/wisdmcanarycgi?'+querystr;
		if (callback) callback();
	}
	return url;
};
*/

//send an empty request every 30 seconds and renew the identity certificate
Wisdm._empty_request_scheduled=false;
Wisdm.schedule_empty_request=function() {
	if (Wisdm._empty_request_scheduled) return;
	Wisdm._empty_request_scheduled=true;
	setTimeout(function() {
		Wisdm.send_empty_request();
		Wisdm._empty_request_scheduled=false;
		Wisdm.schedule_empty_request(); //repeat perpetually
	},30000);
}
Wisdm.send_empty_request=function() {
	if (Wisdm.session_id!=='') {
		
		var id_info=Wisdm._get_identity_info();
		var certificate_id=id_info.identity_certificate_id||'';
		if (certificate_id) {
			console.log ('[sending request]');
			Wisdm.makeRequest({name:'renewIdentityCertificate',certificate_id:certificate_id,_report_error:false},function(tmp0) {
				if (tmp0.success=='true') {
					console.log ('ok.');
				}
				else {
					console.log(tmp0.error);
				}
			});
		}
		else {
			console.log ('[sending empty request]');
			Wisdm.makeRequest({name:'empty'},function(tmp0) {
				console.log ('ok.');
			});
		}
	}
};
Wisdm.schedule_empty_request();
//////////////////////////////////////////////////////////////////////////////

Wisdm.getCookie=function(c_name,default_val) {
	var i,x,y,ARRcookies=document.cookie.split(";");
	for (i=0;i<ARRcookies.length;i++) {
		x=ARRcookies[i].substr(0,ARRcookies[i].indexOf("="));
		y=ARRcookies[i].substr(ARRcookies[i].indexOf("=")+1);
		x=x.replace(/^\s+|\s+$/g,"");
		if (x==c_name) {
			return unescape(y);
		}
	}
	return default_val;
};
Wisdm.setCookie=function(c_name,val) {
	var exdays=1;
  var exdate=new Date();
	exdate.setDate(exdate.getDate() + exdays);
	var c_value=escape(val) + ((exdays===null) ? "" : ";path=/;expires="+exdate.toUTCString());
	document.cookie=c_name + "=" + c_value;
};


//GetBase64File
function GetBase64File(url,callback) {
	$.get(url,function(txt0) {
		if ((txt0)&&(txt0.length>0)) {
			Wisdm.sessionStats.bytesReceived+=txt0.length;
			var data0=Base64Binary.decode(txt0);
			callback({Content:data0,success:true});
		}
		else callback({success:false});
	}).fail(function() {
		callback({success:false});
	});
}

onWisdm=function(callback) {callback();}; //from now on, execute any new callbacks right away -- (perhaps remove this)
