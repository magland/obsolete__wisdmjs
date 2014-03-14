
///SIMPLEST USAGE ///////////////////////////////
//initializeWisdmBanner({content:$('#content')});
/////////////////////////////////////////////////

require(banner.js);
require(background.js);
require("pages:/3rdparty/normalize/normalize.css");
require("pages:/3rdparty/contextpopup/contextpopup.js");

function initializeWisdmBanner(options) {
	var X=new WisdmBanner();
	X.initialize(options);
	return X;
}

function WisdmBanner() {
	var that=this;
	
	var m_div=$('<div></div>');
	var m_background_div=$('<div></div>');
	var m_params={};
	
	this.initialize=function(params) {
		m_params=$.extend({},{content:null,onChangeNode:null,background:true,style:'light',query_params:[],allow_login:true,overflow:'hidden'},params);
		
		if (m_params.content) {
			m_params.content.css({
				position:'absolute',
				left:0,right:0,
				top:35,bottom:15,
				overflow:m_params.overflow
			});
		}
		
		if (m_params.style=='dark') {
			$('body').css({'background-color':'rgb(80,80,80)',color:'rgb(230,255,230)'});
			if (m_params.content) m_params.content.addClass('wisdm-dark');
		}
		else if (m_params.style=='light') $('body').css({'background-color':'rgb(255,255,255)'});
		
		if (m_params.background) {
			$('body').append(m_background_div);
			m_background_div.WisdmBackground({style:m_params.style});
		}
		
		var div0=$('<div></div>');
		$('body').append(m_div);
		m_div.WisdmBanner({},function() {
			
			//HOME
			m_div.find('#home').click(function(evt) {
				//window.location='$approot$/../../wisdmdemo/wisdmdemo.html?node='+Wisdm.sessionNode;
				window.location='../../apps/default/?node='+Wisdm.sessionNode;
			});
			
			//ABOUT
			//m_div.find('#about').click(function(evt) {
			//	window.location='../../apps/about?node='+Wisdm.sessionNode;
			//});
			
			//CONTROL PANEL
			/*
			var open_control_panel=function(target) {
				var url0='$approot$/../../controlpanel/controlpanel.html?node='+Wisdm.sessionNode;
				window.open(url0,target);
			};
			m_div.find('#control_panel').click(function(evt) {open_control_panel('_self');});
			m_div.find('#control_panel').contextPopup({
				items: [
					{label:'Open control panel in new tab',action:function() {open_control_panel('_blank');} }
				]
			});
			*/
			
			//PAGES
			/*
			var open_pages=function(target) {
				window.open('$approot$/../../wisdmpagemanager/wisdmpagemanager.html',target);
			};
			m_div.find('#pages').click(function() {
				open_pages('_self');
			}).hide();
			m_div.find('#pages').contextPopup({
				items: [
					{label:'Open pages in new tab',action:function() {open_pages('_blank');} }
				]
			});
			*/
			
			//TERMINAL
			var open_terminal=function(target) {				
				//window.open('$approot$/../../wisdmterminal/wisdmterminal.html?node='+Wisdm.sessionNode,target);
				window.open('../../apps/terminal/?node='+Wisdm.sessionNode,target);
			};
			m_div.find('#terminal').click(function() {
				open_terminal('_self');
			});
			m_div.find('#terminal').contextPopup({
				items: [
					{label:'Open terminal in new tab',action:function() {open_terminal('_blank');} }
				]
			});
			
			if (!m_params.allow_login) m_div.find('#menuright').hide();
		});
		Wisdm.onUserChanged(function() {
			if (Wisdm.currentUser=='magland')
				m_div.find('.admin_page').show();
			else 
				m_div.find('.admin_page').hide();
			update_footer();
		});
		Wisdm.onSessionOpened(function() {update_footer();});
		m_div.bind('loginrequest', function(e,logindata){
			//logindata is in the format {user: xxxx, password: xxxx} so it can be directly sent to Wisdm for a login attempt
			
			//m_div.trigger('login',logindata);
			Wisdm.setCurrentUser({user:logindata.user,password:logindata.password},function(tmp2) {
				if (tmp2.success=="true") {
					//
				}
				else {
					jAlert('Incorrect user name or password.');
				}
			});
		});
		m_div.bind('logoutrequest',function(e,obj) {
			Wisdm.setCurrentUser({user:''},function(tmp2) {
			});
		});
		m_div.bind('loginasrequest',function(e,obj) {
			var user0=Wisdm.currentUser;
			jLogin("Please log in:",user0,'',"WISDM login",function(tmp) {
				if (tmp!==null) {
					Wisdm.setCurrentUser({user:tmp[0],password:tmp[1]},function(tmp2) {
						if (tmp2.success=="true") {
							Wisdm.setCookie('wisdmLogin-user',tmp[0]);
							var ret0={success:true,user:tmp[0]};
						}
						else {
							jAlert('Incorrect user name or password.');
						}
					});
				}
			});
		});
		m_div.bind('profilerequest',function(e,obj) {
			window.location.href='$approot$/../../profile/profile.html?node='+Wisdm.sessionNode+'&user='+Wisdm.currentUser;
		});
		update_footer();
	};
	
	var update_footer=function() {
		var X0=m_div.find('.wisdmbanner_footer');
		var txt='';
		if (m_params.onChangeNode) txt+='<a href="#" id=change_node>Node: $node$</a>'; 
		else txt+='Node: $node$';
		txt=txt.replace('$node$',Wisdm.sessionNode);
		X0.html(txt);
		X0.find('#change_node').click(function() {
			that.selectNode();
		});
	};
	
	this.selectNode=function() {
		new SelectionDialog({choices:['DEFAULT','TRC','LSNI','FBIRN'],choice:Wisdm.sessionNode,title:'Change Node',label:'Node: '},function(new_node) {
			if (new_node) {
				if ($.isFunction(m_params.onChangeNode)) {
					m_params.onChangeNode(new_node);
				}
				else {
					var url0=window.location.protocol + '//' + window.location.host + window.location.pathname+'?node='+new_node;
					for (var jj=0; jj<m_params.query_params.length; jj++) {
						var query_param=m_params.query_params[jj];
						var val0=Wisdm.queryParameter(query_param,'');
						if (val0!=='')url0+='&'+query_param+'='+val0;
					}
					window.location.href=url0;
				}
			}
		});
	};
	
	//this.onLogin=function(callback) {
	//	m_div.bind('login',callback);
	//};
	
	
	function SelectionDialog(params,callback) {
		var that=this;
		
		params=$.extend({},{choices:[],title:'',label:'',choice:''},params);
			
		var m_div=$('<div><div id=dialog_content></div></div>');
		var m_title='';
		var m_select=$('<select></select>');
		
		m_div.find('#dialog_content').append(params.label);
		m_div.find('#dialog_content').append(m_select);
		
		for (var ii=0; ii<params.choices.length; ii++) {
			var str=params.choices[ii];
			var elmt=$('<option value="'+str+'">'+str+'</option>');
			m_select.append(elmt);
		}
		m_select.val(params.choice);
		
		
		m_div.dialog({width:300,
			height:200,
			resizable:false,
			modal:true,
			title:params.title,
			buttons: {}
		});
		m_select.change(function() {
			m_div.dialog('close');
			if (callback) callback(m_select.val());
		});
	}
}
