$(document).ready(function() {
	var socket = io();

	// Socket emit

	// Requests

	function loadRequests() {
		sendMsg({'event': 'ldreq'});
	}

	loadRequests();

	setInterval(function() {
		loadRequests();
	}, 5000);

	// Load Videos

	function loadVideos() {
		sendMsg({'event': 'ldvid'});
	}

	loadVideos();

	$('#refresh_videos').click(function() {
		$('#videos').empty();
		loadVideos();
	});

	// Load Contacts

	function loadContacts() {
		sendMsg({'event': 'ldcnt'});
	}

	loadContacts();

	$('#refresh_contacts_chat').click(function() {
		$('#contacts_container_chat').empty();
		$('#contacts_container_collegamenti').empty();
		loadContacts();
	});

	$('#refresh_contacts_collegamenti').click(function() {
		$('#contacts_container_chat').empty();
		$('#contacts_container_collegamenti').empty();
		loadContacts();
	});

	// Socket.on

	socket.on('message', function(msg) {
		var event = msg['event'];
		if(event !== null && event !== undefined) {
			var payload = msg['payload'];
			switch(event) {
				case 'found':
				var list = payload['list'];
				result.empty();
				for(i=0;i<list.length;i++) {
					result.append("<option id=" + list[i] + "_opt value=" + list[i] + "/>");
				}
				break;
				case 'rqsts':
				console.log('onRequests');
				onRequests(payload);
				break;
				case 'vids':
				console.log('onVideos');
				onVideos(payload);
				break;
				case 'cntcs':			///////////////////////////////////////////// Provvedere ad un meccanismo di presenza
				console.log('onContacts');
				onContacts(payload);
				break;
			}
		}
	});

	// Search

	var query = null;
	var prev_query = null;

	var query_input = $('#query');
	var result = $('#result');
	query_input.keyup(function() {
		search();
	});
	query_input.change(function() {
		search();
	});
	$('#query_container').focusin(function() {
		query_input.select();
	});
	$('#lkfor').click(function() {
		connectWith();
	});

	function search() {
		query = query_input.val();
		var doit = false;
		if (prev_query === null || prev_query !== query) {
			prev_query = query;
			doit = true;
		}
		if (doit && query.length >= 3) {
			console.log('Search for ' + query + '.');

			var msg = {
				'event': 'lkfor',
				'payload': {
					'query': query
				}
			};
			sendMsg(msg);
		}
		if (query.length < 3) {
			result.empty();
		}
	}

	function connectWith() {
		if($('#' + query + '_opt').length) {
			if(confirm('Vuoi connetterti con ' + query + '?')) {
				console.log("Connect to " + query);
				var msg = {
					'event': 'cnnwt',
					'payload': {
						'target': query
					}
				}
				sendMsg(msg);
				alert('Richiesta inviata');
			}
			query_input.val('');
			query = null;
			result.empty();
		}
	}

	function onRequests(payload) {
		var requests = payload['requests'];
		$("#request_counter").text(requests.length);
		for (i = 0; i < requests.length; i++) {
			$("#request_container").append("<li><h3 id='req_" + i + "'>" + requests[i] + "</h3></li>");
			$("#req_" + i).click(function() {
				console.log($(this).text());
				if(confirm("Vuoi connetterti con " + $(this).text() + "?")){
					var msg = {
						'event': 'okreq', 
						'payload': {
							'requestor': $(this).text()
						}
					};
					sendMsg(msg);
				}
				else {
					var msg = {
						'event': 'nkreq',
						'payload': {
							'requestor': $(this).text()
						}
					}
					sendMsg(msg);
				}
				$(this).remove();
				var req_n = parseInt($("#request_counter").text(), 10);
				--req_n;
				$("#request_counter").text(req_n);
			});
		}
	};

	// Contacts

	function onContacts(payload) {
		var contacts = payload['contacts'];
		for(i = 0; i < contacts.length; i++) {
			contact = contacts[i].user;
			$('#contacts_container_chat').append(
				"<span id='" + contact + "_box'>" +
				"<input type='radio' name='rGroup' id='" + contact + "' value='" + contact + "'/>" +
				"<label class='radio button small' for='" + contact + "'>" + contact + "</label>" +
				"</span><br/>"
			);
			if(contacts[i].online) {
				$('#' + contact).prop('disabled', false);
			}
			else{
				$('#' + contact).prop('disabled', true);
			}

			$('#contacts_container_collegamenti').append(
				"<span id='" + contact + "_box'>" +
				"<button class='button small' id='" + contact + "_delete' value='" + contact + "'>" + contact + "</button>" +
				"</span><br/>"
			);
			$('#' + contact + '_delete').click(function() {
				deleteContact($(this).val());
			});
		}
	}

	function deleteContact(contact) {
		if(confirm('Vuoi disconnetterti da ' + contact + '?')) {
			console.log("Disconnect from " + contact);
			var msg = {
				'event': 'dcnwt',
				'payload': {
					'target': contact
				}
			}
			sendMsg(msg);
			alert('Richiesta inviata');
		}
	}

	// Search Chat and Delete

	var query_chat_input = $('#query_chat');
	var query_delete_input = $('#query_delete');
	query_chat_input.change(function() { decimateContacts(query_chat_input.val()); });
	query_chat_input.keyup(function() { decimateContacts(query_chat_input.val()); });
	query_delete_input.change(function() { decimateContacts(query_delete_input.val()); });
	query_delete_input.keyup(function() { decimateContacts(query_delete_input.val()); });

	function decimateContacts(query) {
		if(query !== '') {
			$('span[id*="_box"]:not([id*="' + query +'"])').hide();
			$('span[id*="_box"][id*="' + query +'"]').show();
		} else $('span[id*="_box"]').show();
	}

	// Logout

	var l_btn = $('#logout');

	l_btn.click(function() {
		logout();
	});

	function logout() {
		sendMsg({'event': 'lgout'});
		$.cookie('user', null);
		$.cookie('session', null);
		window.location.href='./index.html';
	}

	function onVideos(payload) {
		console.log(payload);
		var contact = payload['contact'];
		if(contact !== null && contact !== undefined) {
			var videos = payload['videos'];
			if(videos !== null && videos !== undefined) {
				for (var j = 0; j < videos.length; j++) {
					video = videos[j];
					id = video.id;
					name = video.name;
					console.log('Owner: ' + contact + ' Video n. ' + id + ' ' + name);
					$('#videos').append(
						'<div class="outher-container">' +
						'<header>' +
						'<h1>' + contact + '</h1>' +
						'<h3>' + name + '<button id="play_' + id + '">Play</button><button id="stop_' + id + '">Stop</button></h3>' +
						'</header>' +
						'<div class="inner-container">' +
						'<video id="video_' + id + '" controls autoplay></video>' +
						'</div>' +
						'</div>'
						);
					$('#play_' + id).click(function (event) {
						var id = $(event.target).attr('id').substring(5, $(event.target).attr('id').length);
						playVideo(id);
					});
					$('#stop_' + id).prop('disabled', true);
					$('#stop_' + id).click(function (event) {
						var id = $(event.target).attr('id').substring(5, $(event.target).attr('id').length);
						stopVideo(id);
					});
				}
			}
		}
	}

	function sendMsg(msg) {
		socket.emit('message', msg);
	}
});