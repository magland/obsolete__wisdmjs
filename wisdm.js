/*
NOTE: 
This is a very old file, from earliest versions of WISDM, so it is quite sloppy. 
Planning to rewrite it.
*/

require("wisdmcanary/wisdmcanary.js");
require('layout/banner/wisdmbanner.js');
require('style/wisdmstyle.js');

function initializeWisdmSession(params,callback) {
	var WM=new WisdmManager();
	WM.initializeSession(params,callback);
}

function WisdmManager() {
	
	var that=this;
	
	this.initializeSession=function(params,callback) {return _initializeSession.apply(this,arguments);};
	this.onUserChanged=function(callback) {Wisdm.onUserChanged(callback);};
	this.changeUser=function(params,callback) {return _changeUser.apply(this,arguments);};
	this.logOut=function(params,callback) {return _logOut.apply(this,arguments);};
		
	var _initializeSession=function(params,callback) {
		var params2=$.extend({
			host:'localhost',node:'DEFAULT',
			user:'',user_domain:'',password:'',
			login:false,
			manual:false,selectuser:false
		},params);
		
		params2.user_domain=params2.user_domain||location.hostname;
		
		var do_open_session=function(CB) {
			jAlert('Initializing connection to node ('+params2.node+')');
			Wisdm.openSession({host:params2.host,node:params2.node},function(tmp1) {
				if ((!tmp1.session_id)||(tmp1.session_id==='')) {
					jAlert('Unable to open session: '+params2.host+','+params2.node);
					callback({success:false,error:'Error opening session.'});
					return;
				}
				jAlert(null);
				CB();
			});
		};
		
		var do_login=function(CB) {
			if (!params2.login) {
				CB();
				return;
			}
			if ((params2.user)&&(params2.user==Wisdm.currentUser)&&(params2.user_domain==Wisdm.currentUserDomain)) {
				//already logged in as the correct user
				CB();
				return;
			}
			if ((!params2.user)&&(Wisdm.currentUser)) {
				//already logged in
				CB();
				return;
			}
			wisdmLogin({user:params2.user,user_domain:params2.user_domain,password:params2.password,manual:params2.manual,selectuser:params2.selectuser},function(tmp1) {
				if (!tmp1.success) {
					console.log ('Unable to log in: '+params2.user+' @ '+params2.user_domain);
					if (params2.manual) callback({success:false,error:'Unable to log in.'});
					else CB();
					return;
				}
				else {
					CB();
				}
			});
		};
		
		var supports_local_storage=function() {
      try {
        localStorage['testing-local-storage']='test_value';
        localStorage.removeItem('testing-local-storage');
        return true;
      } catch(e) {
        return false;
      }
		};
		
		var timer0=new Date();
		var steps_completed=0;
		var step_completed=function() {
			steps_completed++;
			if (steps_completed==2) {
				console.log ('ELAPSED TIME FOR INITIALIZING SESSION (ms): '+((new Date())-timer0));
				callback({success:true});
			}
		};	
		do_open_session(function() {
			step_completed();
			do_login(function() {
				step_completed();
			});
		});
		
	};
	var _changeUser=function(params,callback) {
		if (!params) params={};
		wisdmLogin(params,callback);
	};
	var _logOut=function(params,callback) {
		if (!params) params={};
		Wisdm.setCurrentUser({user:'',user_domain:''},callback);
	};
}

//copied from wisdmlogin.js on 3/7/2013
function wisdmLogin(params,callback) {
	
	/*This is used temporarily for demo purposes*/
	/*if (Wisdm.queryParameter('login_as_magland')=='temporary') {
		Wisdm.setCurrentUser({user:'magland',password:'temporary'},function(tmp2) {
			if (tmp2.success=="true") {
				var ret0={success:true,user:'magland'};
				if (callback) callback(ret0);
			}
			else {
				jAlert('Incorrect user name or password.');
				if (callback) callback({success:false});
			}
		});
		return;
	}*/
	////////////////////////////////////////////
	
	var user0=Wisdm.queryParameter('user','');
	var user_domain0=Wisdm.queryParameter('user_domain','');
	var pass0=Wisdm.queryParameter('password','');
	if (!('manual' in params)) params.manual=true;
	if (params.password) pass0=params.password;
	if (params.user) user0=params.user;
	if (params.user_domain) user0=params.user_domain;
	
	if ((user0!=='')&&(pass0!=='')) {
		Wisdm.setCurrentUser({user:user0,user_domain:user_domain0,password:pass0},function(tmp2) {
			if (tmp2.success=="true") {
				Wisdm.setCookie('wisdmLogin-user',user0);
				var ret0={success:true,user:user0,user_domain:user_domain0};
				if (callback) callback(ret0);
			}
			else {
				params.password='';
				wisdmLogin(params,callback);
			}
		});
		return;
	}
	
	var manual_login=function(mlparams) {
		//pass0=Wisdm.getCookie('wisdmLogin-pass');
		if (mlparams.selectuser) {
			Wisdm.getAllUsers({},function(ret_users) {
				var users0=ret_users.users||[];
				if (!users0) {
					manual_login({});
					return;
				}
				select_user({users:users0},function(user1) {
					manual_login({user:user1});
				});	
			});
			return;
		}
		if ('user' in mlparams) user0=mlparams.user;
		if (user0==='') user0=Wisdm.getCookie('wisdmLogin-user');
		if (user0=='magland') pass0=pass0||localStorage.magland_password||'';
		jLogin("Please log in:",user0,pass0,"WISDM login",function(tmp) {
			if (mlparams.user1) user0=mlparams.user1;
			if (tmp!==null) {
				Wisdm.setCurrentUser({user:tmp[0],password:tmp[1]},function(tmp2) {
					if (tmp2.success=="true") {
						
						if ((tmp[0]==tmp[1])&&(tmp[0]!='demo')) { //user and password are the same
							function prompt_new_password(str) {
								jPassword((str||'')+'Please select a stronger password for '+tmp[0],'','Stronger password required',function(newpass1) {
									if (!newpass1) return;
									jPassword('Please confirm new password for '+tmp[0]+':','','Stronger password required',function(newpass2) {
										if (newpass2!=newpass1) {
											prompt_new_password('Passwords do not match.\n ');
											return;
										}
										else {
											Wisdm.setUserPassword({user:tmp[0],password:newpass1,old_password:tmp[1]},function(tmp8) {
												if (tmp8.success=='true') {
													jAlert('Password successfully changed for '+tmp[0]);
												}
											});
											return;
										}
									});
								});
							}
							//prompt_new_password();
						}
						
						Wisdm.setCookie('wisdmLogin-user',tmp[0]);
						//Wisdm.setCookie('wisdmLogin-pass',tmp[1]);
						var ret0={success:true,user:tmp[0]};
						if (callback) callback(ret0);
					}
					else {
						jAlert('Incorrect user name or password. Please contact Jeremy if you forgot your login information.');
						if (callback) callback({success:false});
					}
				});
			}
			else {
				if (callback) callback({success:false});
			}
		});
	}
 
	
	if (params.manual) manual_login(params);
	else {
		if (callback) callback({success:false});
	}
	
}


function select_user(params,callback) {
	
	var width=400;
	var height=300;
	
	var X0=$('<div style="overflow:auto"></div>');
	
	//var table0=$('<table></table>');
	//X0.append(table0);
	
	params.users.sort();
	
	var html1='';
	for (var j=0; j<params.users.length; j++) {
		var user0=params.users[j];

		var html0='<a href="javascript:;" data-user='+user0+'>'+user0+'</a>';
		//table0.append('<tr><td>'+html0+'</td></tr>');
		if (j>0) html1+=', ';
		html1+=html0;
	}
	X0.html(html1);
	
	var dialog0=$('<div id="dialog"></div>');
	dialog0.append(X0);
	dialog0.dialog({
		width:width,
		height:height,
		resizable:false,
		modal:true,
		title:'Select User'
	});
	X0.find('a').click(function() {
		dialog0.dialog('close');
		callback($(this).attr('data-user'));
	});
}
