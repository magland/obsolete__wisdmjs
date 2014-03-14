var DONE_ALT = 'OK';
var PENDING_ALT = 'Waiting';
var UPLOADING_ALT = 'Uploading...';
var ERROR_ALT = 'Error!';
//var UPLOAD_END_MESSAGE = 'Please allow some time to finish processing.\nData should be available shortly. Click the refresh button to see the updated content';

//Paths
var DONE = '$wisdmpages$/images/themes/wisdm/green16.png';
var PENDING = '$wisdmpages$/images/themes/wisdm/clock16.png';
var UPLOADING = '$wisdmpages$/images/themes/wisdm/network16.png';
var ERROR = '$wisdmpages$/images/themes/wisdm/red16.png';

function uploadSingleFile(callback) {
	var uploader=new FileUploader();
	uploader.setMultipleFilesMode(false);
	uploader.showUploadDialog({});
	uploader.onFilesLoaded(function() {
		//this function will be called once the files are 'loaded' but not yet 'uploaded'
		if (uploader.fileCount()==1) { //we require that there is only one file selected
			callback({file_name:uploader.fileName(0),file_data:new Uint8Array(uploader.fileData(0))});
			uploader.setFileUploadedToServer(0);
		}
	});
}

function FileUploader() {
	var that=this;
	
	this.setMultipleFilesMode=function(val) {m_multiple_files_mode=val;};
	this.showUploadDialog=function(params) {return _showUploadDialog.apply(this,arguments);};
	this.setFileUploadedToServer=function(file_num){ return _setFileUploadedToServer(file_num); };
	this.onFilesLoaded=function(callback) {m_files_loaded_handlers.push(callback);};
	this.onUploadsCompleted=function(callback) {m_uploads_completed_handlers.push(callback);};
	this.fileCount=function(){return m_files.length;};
	this.fileName=function(index) {return m_files[index].name;};
	this.fileData=function(index) {return m_files_data[index];};
	this.hide=function() {dialog0.dialog("close");};
	this.show=function() {dialog0.dialog("open");};

	var dialog0=$('<div id="dialog"></div>');
	var X0=$('<div></div>');
	var m_multiple_files_mode=true;
	var m_button=null;
	var m_files=[];
	var m_files_data={};
	var m_files_loaded_handlers=[];
	var m_uploads_completed_handlers=[];
	var m_num_loaded=0;
	var m_num_uploaded=0;
	var m_file_count=0;
	
	var on_upload=function(evt) {
		X0.find('#upload_button').hide();
		X0.find('#prog_evol').show();
		Wisdm.resetImportFileBytesUploaded();
		
		m_file_count=evt.target.files.length;
		for (var ii=0; ii<m_file_count; ii++) {
			var file_num=ii;
			m_files.push(evt.target.files[file_num]);
			//We make sure we get the name, first line was enough in my browser but I think it didnt on yours
			var name = m_files[file_num].fileName;
			if (name == undefined || name == '') name = m_files[file_num].name;
		}
		
		if (m_file_count>0) read_file(0);
		on_timer();
	}
	var read_file=function(file_num) {
		var reader=new FileReader();
		reader.onload=function(ee) {
			var temp = ee.target.result;
			m_files_data[file_num]=temp;
			m_num_loaded++;
				
			
			if (file_num+1<m_file_count) {
				setTimeout(function() {read_file(file_num+1);},10); //read the next file
			}
			else {
				for (var jj=0; jj<m_files_loaded_handlers.length; jj++){
					(m_files_loaded_handlers[jj])(true);
				}
			}
		}
		reader.readAsArrayBuffer(m_files[file_num]);
	}
	var _setFileUploadedToServer=function(file_num){
		m_num_uploaded++;
		if (m_num_uploaded>=m_file_count) {
			for (var jj=0; jj<m_uploads_completed_handlers.length; jj++) {
				(m_uploads_completed_handlers[jj])();
			}
			dialog0.dialog('close');;
		}
	}
	var update_progress_bar=function(){
		var val0=0;
		if (m_file_count>0) val0=Math.round((m_num_loaded+m_num_uploaded)/(2*m_file_count)*100);
		X0.find('#progress').val(val0);
	}
	var update_progress_label=function() {
		var txt0='';
		if (m_num_loaded<m_file_count) {
			txt0='Loading file ';
			if (m_file_count>1) txt0+=(m_num_loaded+1)+' of '+m_file_count;
			txt0+='...';
		}
		else {
			txt0='Uploading file  ';
			if (m_file_count>1) txt0+=(m_num_uploaded+1)+' of '+m_file_count;
			txt0+='...';
			var bytes0=Wisdm.getImportFileBytesUploaded();
			if (bytes0>0) {
				txt0+=' ('+(bytes0/1000000)+' megabytes uploaded)';
			}
		}
		X0.find('#label').text(txt0);
	};
			
	//Popup Extra Info
	var _showUploadDialog=function(params){			
		
		if (m_multiple_files_mode)
			m_button=$('<input type="file" name="files[]" label="Upload" multiple></input>');
		else
			m_button=$('<input type="file" name="files[]" label="Upload"></input>');
		m_button.change(function(evt) {on_upload(evt);});
		
		//Popup
		var W=600;
		var H=90;
		var label0='Upload files';
		X0.css('position','absolute');
		X0.css('width',W);
		X0.css('height',H);
		//Popup Basic Content
		X0.append('<p><span id="label"></span></p>');
		X0.append('<p><span id="upload_button"></span></p>');
		X0.append('<p id="prog_evol"><progress id="progress" max="100" value="0"></progress><span id="more_button"></span></p>');
		
		X0.find('#label').text(label0);
		X0.find('#upload_button').append(m_button);
		X0.find('#prog_evol').hide();
		dialog0.css('overflow','hidden');
		dialog0.append(X0);
		$('body').append(dialog0);
		dialog0.dialog({width:W+20,
										height:H+60,
										resizable:false,
										modal:true,
										title:'File Uploader'});
		
	}
	var on_timer=function() {
		update_progress_label();
		update_progress_bar();
		if (m_num_uploaded<m_file_count) {
			setTimeout(on_timer,100);
		}
	}
}
