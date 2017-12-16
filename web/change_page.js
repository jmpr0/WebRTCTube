var doc_ready = false;

var home = null;
var bacheca = null;
var chat = null;
var collegamenti = null;
var impostazioni = null;

$(document).ready(function () {
	home = $('#home');
	bacheca = $('#bacheca');
	chat = $('#chat');
	collegamenti = $('#collegamenti');
	impostazioni = $('#impostazioni');

	$('#welcome').text('Home di ' + $.cookie('user'));

	doc_ready = true;
});

function loadHome() {
	if(doc_ready) {
		$('body').trigger('click'); // 'Accrocchio' to hide menu after page selection
		home.show();
		bacheca.hide();
		chat.hide();
		collegamenti.hide();
		impostazioni.hide();
		$('#welcome').text('Home di ' + $.cookie('user'));
	}
}

function loadBacheca() {
	if(doc_ready) {
		$('body').trigger('click'); // 'Accrocchio' to hide menu after page selection
		home.hide();
		bacheca.show();
		chat.hide();
		collegamenti.hide();
		impostazioni.hide();
		$('#welcome').text('Bacheca di ' + $.cookie('user'));
	}
}

function loadChat() {
	if(doc_ready) {
		$('body').trigger('click'); // 'Accrocchio' to hide menu after page selection
		home.hide();
		bacheca.hide();
		chat.show();
		collegamenti.hide();
		impostazioni.hide();
		$('#welcome').text('Chat di ' + $.cookie('user'));
	}
}

function loadCollegamenti() {
	if(doc_ready) {
		$('body').trigger('click'); // 'Accrocchio' to hide menu after page selection
		home.hide();
		bacheca.hide();
		chat.hide();
		collegamenti.show();
		impostazioni.hide();
		$('#welcome').text('Collegamenti di ' + $.cookie('user'));
	}
}

function loadImpostazioni() {
	if(doc_ready) {
		$('body').trigger('click'); // 'Accrocchio' to hide menu after page selection
		home.hide();
		bacheca.hide();
		chat.hide();
		collegamenti.hide();
		impostazioni.show();
		$('#welcome').text('Impostazioni di ' + $.cookie('user'));
	}
}