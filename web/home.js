var recording = false;
var playing = false;

var recordingName = null;

var date = null;

$(document).ready(function() {
	navigator.mediaDevices.getUserMedia({audio: true, video: true}).
	then(handleSuccess).catch(function(err) {console.log(err);});

	var socket = io();

	socket.on('message', function(msg) {
		var event = msg['event'];
		if(event !== null && event !== undefined) {
			var payload = msg['payload'];
			switch (event) {
				case 'vidsv':
				alert('Video salvato con successo');
				restoreStream();
				break;
				case 'error':
				alert(payload['reason']);
				break;
				case 'connected':
				alert(payload['user'] + ' connected!');
			}
		}
	});

	var video = document.querySelector('#gum-local');

	var mediaSource = new MediaSource();
	mediaSource.addEventListener('sourceopen', handleSourceOpen, false);
	var mediaRecorder = undefined;
	var recordedBlobs = undefined;
	var sourceBuffer = undefined;

	var rs_btn = $('#reg-pause');
	var s_btn = $('#save');
	var a_btn = $('#abort');
	var fn_input = $('#filename');
	rs_btn.prop('disabled', false);
	s_btn.prop('disabled', true); 
	a_btn.prop('disabled', true);
	rs_btn.click(function() {
		if (rs_btn.text() == "Registra") {
			startRecording();
		} else {
			stopRecording();
		}
	});
	s_btn.click(function() {
		saveRecorded();
	});
	a_btn.click(function() {
		abortRecording();
	});
	fn_input.focus();

	function handleSuccess(stream) {
		console.log("Dispositivo connesso.");
		stream.oninactive = function() {
			console.log('Stream inactive');
		};
		window.stream = stream;
		restoreStream();
		console.log(stream);
	}

	function startRecording(){
		if(fn_input.val() === '') {
			alert('Inserire un nome per il video');
			fn_input.focus();
			return;
		}

		if(recording) return;
		recording = true;
		playing = false;

		console.log("Registra");
		rs_btn.text("Stop");
		s_btn.prop('disabled', true);
		a_btn.prop('disabled', false);
		fn_input.prop('disabled', true);

		recordedBlobs = [];
		var options = {mimeType: 'video/webm\;codecs=vp8'};
		if (!MediaRecorder.isTypeSupported(options.mimeType)) {
			console.log(options.mimeType + ' is not Supported');
			options = {mimeType: 'video/webm'};
			if (!MediaRecorder.isTypeSupported(options.mimeType)) {
				console.log(options.mimeType + ' is not Supported');
				options = {mimeType: ''};
			}
		}
		try {
			mediaRecorder = new MediaRecorder(window.stream, options);
		} catch (e) {
			console.error('Exception while creating MediaRecorder: ' + e);
			alert('Exception while creating MediaRecorder: ' + e + '. mimeType: ' + options.mimeType);
			return;
		}
		console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
		mediaRecorder.onstop = handleStop;
		mediaRecorder.ondataavailable = handleDataAvailable;
		date = new Date().getTime();
		mediaRecorder.start(10); // collect 10ms of data for each blob
		console.log('MediaRecorder started', mediaRecorder);

		recordingName = 'test.webm';
		if(fn_input.val() !== '')
			recordingName = fn_input.val() + '.webm';
	};

	function stopRecording(){
		if(!recording) return;
		recording = false;
		playing = false;

		console.log("Stop");
		rs_btn.text("Registra");
		rs_btn.prop('disabled', true);
		s_btn.prop('disabled', false);
		a_btn.prop('disabled', false);
		fn_input.prop('disabled', true);

		mediaRecorder.stop();
		recordedBlobs.duration = new Date().getTime() - date;
		console.log('Recorded Blobs: ', recordedBlobs);

		video.controls = true;
		video.removeAttribute('autoplay');
		
		alterStream();
	};

	function abortRecording(){
		if(recording)
			mediaRecorder.stop();

		recording = false;
		playing = false;

		console.log("Annulla.");
		rs_btn.text("Registra");
		rs_btn.prop('disabled', false);
		a_btn.prop('disabled', true);
		s_btn.prop('disabled', true);
		fn_input.prop('disabled', false);

		restoreStream();

		console.log('Deleted');

		video.controls = false;
	};

	function saveRecorded(){
		if(confirm('Vuoi salvare il video sul server? Sarà disponibile per 45 minuti più la sua durata a tutte le proprie connessioni')) {
			console.log("Salva.");
			rs_btn.prop('disabled', false);
			s_btn.prop('disabled', true);
			a_btn.prop('disabled', true);
			fn_input.prop('disabled', false);

			var blob = new Blob(recordedBlobs, {type: 'video/webm\;codecs=vp8'});

			console.log(blob);
			console.log(typeof(blob));
			console.log(blob.size);

			var url = window.URL.createObjectURL(blob);
			var a = document.createElement('a');
			a.style.display = 'none';
			a.href = url;
			if(fn_input.val() == '')
				a.download = 'test.webm';
			else
				a.download = fn_input.val() + '.webm';
			document.body.appendChild(a);
			a.click();
			setTimeout(function() {
				document.body.removeChild(a);
				window.URL.revokeObjectURL(url);
			}, 100);
			
			var msg = {
				'event': 'svvid',
				'payload': {
					'video': {
						'name': recordingName,
						'blob': blob,
						'duration': recordedBlobs.duration
					}
				}
			};

			socket.emit('message', msg);

			video.controls = false;
		}
		abortRecording();
	};

	function handleSourceOpen(event) {
		console.log('MediaSource opened');
		sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vp8"');
		console.log('Source buffer: ', sourceBuffer);
	};

	function handleDataAvailable(event) {
		console.log("Data available.");
		if (event && event.data && event.data.size > 0) {
			recordedBlobs.push(event.data);
		}
	}

	function handleStop(event) {
		console.log('Recorder stopped: ', event);
	}

	// PENSA AD UNIRE LE DUE FUNZIONI CHE SEGUONO___
	//												|
	function restoreStream() {//					|
		console.log("Restoring stream.");//			|
		video.setAttribute('autoplay', '');//	<---- Davvero serve???
		if(window.URL)
			video.src = window.URL.createObjectURL(window.stream); 
		else
			video.srcObj = window.stream;
	}

	function alterStream() {
		console.log("Altering stream.");
		var superBuffer = new Blob(recordedBlobs, {type: 'video/webm'});
		if(window.URL)
			video.src = window.URL.createObjectURL(superBuffer);
			// video.src = window.URL.createObjectURL(window.remoteStream);
			else
				alert('Your browser stay annanz! Change it with some else older =D');
			// video.srcObj = window.remoteStream;
		}

	});