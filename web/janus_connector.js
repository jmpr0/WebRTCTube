var server = null;
if(window.location.protocol === 'http:')
	server = "http://" + window.location.hostname + ":8088/janus";
else
	server = "https://" + window.location.hostname + ":8089/janus";

var rtsp_server = "rtsp://" + window.location.hostname + "/";

var janus = null;

// Streaming plugin vars

var streaming = null;
var requestedVideoId = null;

$(document).ready(function() {
	if(!Janus.isWebrtcSupported()) {
		alert("No WebRTC support...");
		return;
	}

	window.onbeforeunload = function() {
		janus.destroy();
	};

	var token = $.cookie('session');

	// Videocall plugin vars

	var my_video =  document.querySelector('#my_video');
	var peer_video =  document.querySelector('#peer_video');
	var videocall = null;

	// Janus init

	Janus.init({
		debug: true,
		callback: function() {
			janus = new Janus({
				server: server,
				token: token,
				success: function() {
					console.log('SUCCESS!');

					// Videocall plugin attach for Chat

					janus.attach({
						plugin: 'janus.plugin.videocall',
						success: function(pluginHandle) {
							videocall = pluginHandle;
							console.log(videocall);
							registerUser();
						},
						error: function(err) {
							console.log(err);
						},
						onmessage: function(msg, jsep) {
							var result = msg['result'];
							if(result !== undefined && result !== null) {
								var event = result['event'];
								if(event !== undefined && event !== null) {
									switch(event) {
										case 'registered':
										console.log("Registered as " + result['username']);
										break;
										case 'calling':
										console.log("Waiting for the peer to answer...");
										break;
										case 'incomingcall':
										var remoteUser = result['username'];
										console.log("Remote user is " + remoteUser);
										if(confirm('Incoming call from ' + remoteUser)) {
											loadChat();
											inCalling();
											$('#' + remoteUser).attr('checked', true);
											videocall.createAnswer({
												jsep: jsep,
												media: {audio: true, video: true/*, data: true*/},
												trickle: true,
												success: function(jsep) {
													console.log('SDP: ' + jsep);
													var body = {'request': 'accept'};
													videocall.send({'message': body, 'jsep': jsep});
												},
												error: function(err) {
													console.log(err);
												}
											});
										} else {
											console.log('Call refused!');
											doHangup();
										}
										break;
										case 'accepted':
										var remoteUser = result['username'];
										console.log(remoteUser + ' accepted call!');
										if(jsep)
											videocall.handleRemoteJsep({jsep: jsep});
										break;
										case 'hangup':
										console.log('HangUP!');
										outCalling();
										break;
									}
								}
							} else {
								alert(msg['error']);
								outCalling();
							}
						},
						onlocalstream: function(stream) {
							console.log("Chat: local stream setting...");
							window.localStream = stream;
							if(window.URL)
								my_video.src = window.URL.createObjectURL(window.localStream);
							else
								my_video.srcObj = window.localStream;
							console.log("chat: local stream setted.");
						},
						onremotestream: function(stream) {
							console.log("Chat: remote stream setting...");
							console.log(stream);
							window.remoteStream = stream;
							if(window.URL)
								peer_video.src = window.URL.createObjectURL(window.remoteStream); 
							else
								peer_video.srcObj = window.remoteStream;
							console.log("Chat: remote stream setted.");
						}
						// ,
						// ondataopen: function(data) {
						// 	Janus.log("The DataChannel is available!");
						// 	$('#msg_chat').removeAttr('disabled');
						// 	$('#send_msg').removeAttr('disabled');
						// },
						// ondata: function(data) {
						// 	Janus.debug("We got data from the DataChannel! " + data);
						// 	$('#conversation').val($('#conversation').val() + "\n" + data);
						// }
					});

					// Streaming plugin attach for Bacheca

					janus.attach({
						plugin: 'janus.plugin.streaming',
						success: function(pluginHandle) {
							streaming = pluginHandle;
						},
						error: function(err) {
							alert(err);
						},
						onmessage: function(msg, jsep) {
							var result = msg['result'];
							if(result !== null && result !== undefined) {
								var status = result['status'];
								if(status !== null && status !== undefined) {
									switch(status) {
										case 'starting':
										console.log('starting');
										break;
										case 'pausing':
										console.log('pausing');
										break;
										case 'streaming_started':
										console.log('streaming_started');
										break;
										case 'stopped':
										console.log('streaming_stopped');
										break;
									}
								}
							}
							if(msg['error'] !== null && msg['error'] !== undefined) {
								alert(msg['error']);
								stopVideo(requestedVideoId);
								return;
							}
							if(jsep !== null && jsep !== undefined) {
								streaming.createAnswer({
									jsep: jsep,
									media: {audioSend: false, videoSend: false},
									success: function(jsep) {
										var body = {'request': 'start'};
										streaming.send({'message': body, 'jsep': jsep});
									},
									error: function(err) {
										alert(err);
										stopVideo(requestedVideoId);
									}
								});
							}
						},
						onremotestream: function(stream) {
							console.log("Bacheca: remote stream setting...");
							if(window.URL)
								document.querySelector('#video_' + requestedVideoId).src = window.URL.createObjectURL(stream);
							else
								document.querySelector('#video_' + requestedVideoId).srcObj = stream;
							console.log("Bacheca: remote stream setted.");
						}
					});
				},
				error: function(err) {
					console.log(err);
				}
			});
		}
	});

	// Videocall plugin functions

	var call = $('#call');
	var hangup = $('#hangup');
	var send_msg = $('#send_msg');
	call.click(function() {
		var myRadio = $('input[name="rGroup"]');
		var checkedValue = myRadio.filter(':checked').val();
		if(checkedValue)
			doCall(checkedValue);
		else
			alert('No user checked!');
	});
	hangup.attr('disabled', true);
	hangup.click(function() {
		doHangup();
	});
	send_msg.click(function() {
		sendData();
	});

	function registerUser() {
		var user = $.cookie('user');
		var register = {'request': 'register', 'username': user};
		videocall.send({'message': register});
	}

	function doCall(contact) {
		var remoteUser = contact;
		videocall.createOffer({
			media: {audio: true, video: true/*, data: true*/},
			trickle: true,
			success: function(jsep) {
				inCalling();
				var body = {'request': 'call', 'username': remoteUser};
				videocall.send({'message': body, 'jsep': jsep});
			},
			error: function(err) {
				outCalling();
				console.log(err);
			}
		});
	}

	// function sendData() {
	// 	var data = $('#msg_chat').val();
	// 	if(data !== "") {
	// 		videocall.data({
	// 			text: data,
	// 			error: function(reason) { alert(reason); },
	// 			success: function() {
	// 				$('#conversation').val($('#conversation').val() + "\n" + data);
	// 				$('#msg_chat').val('');
	// 			},
	// 		});
	// 	}
	// }

	function doHangup() {
		outCalling();
		var hangup = {'request': 'hangup'};
		videocall.send({'message': hangup});
		videocall.hangup();
	}

	function inCalling() {
		$('#hangup').removeAttr('disabled');
		$('#call').attr('disabled', true);
		my_video.style.visibility = 'visible';
		peer_video.style.visibility = 'visible';

		// $('#msg_chat').removeAttr('disabled');
		// $('#send_msg').removeAttr('disabled');
	}

	function outCalling() {
		$('#call').removeAttr('disabled');
		$('#hangup').attr('disabled', true);
		$('#msg_chat').attr('disabled', true);
		$('#send_msg').attr('disabled', true);
		my_video.style.visibility = 'hidden';
		peer_video.style.visibility = 'hidden';
	}
});

// Streaming plugin functions

function playVideo(id) {
	requestedVideoId = id;

	// If innerHTML is Play, video is started for first time or after a Stop request
	if($('#play_' + requestedVideoId).prop('innerHTML') === 'Play') {
		$('#stop_' + requestedVideoId).prop('disabled', false);
		$('#play_' + requestedVideoId).prop('innerHTML', 'Pause');

		// Send a Stop request to make sure other videos stay calm
		var body = {'request': 'stop'};
		streaming.send({'message': body});

		// Send a Create mountpoint request for current video
		// FIXIT Create request should be send on video creation and not on watching
		var body = {
			"request": "create",
			"type": "rtsp",
			"id": parseInt(requestedVideoId),
			"description" : "RTSP Video",
			"audio": true,
			"video": true,
			"url": rtsp_server + requestedVideoId + ".webm",
		    "permanent": false,
		};
		streaming.send({'message': body});

		// Send a Watch(id) request: in this way we prepare Video Stream
		var body = {'request': 'watch', id: parseInt(requestedVideoId)};
		setTimeout(function() {
			streaming.send({'message': body});
		}, 100);
	} else if($('#play_' + requestedVideoId).prop('innerHTML') === 'Resume') {
		$('#stop_' + requestedVideoId).prop('disabled', false);
		$('#play_' + requestedVideoId).prop('innerHTML', 'Pause');

		// Send a Start request after a Pause request
		// FIXIT seems doesn't Resume, but Restart!
		var body = {'request': 'start'};
		streaming.send({'message': body});
	}
	else if($('#play_' + requestedVideoId).prop('innerHTML') === 'Pause') {
		$('#stop_' + requestedVideoId).prop('disabled', false);
		$('#play_' + requestedVideoId).prop('innerHTML', 'Resume');

		// Send a Pause request for current Stream
		var body = {'request': 'pause'};
		streaming.send({'message': body});
	}
}

function stopVideo(id) {
	requestedVideoId = null;
	$('#stop_' + id).prop('disabled', true);
	$('#play_' + id).prop('innerHTML', 'Play');
	var body = {'request': 'stop'};
	streaming.send({'message': body});
}