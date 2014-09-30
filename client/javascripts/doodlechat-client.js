/* Client Side Code */

$(document).ready(function() {
	var socket = io.connect('http://localhost:8080');

	var status = $('#status'),
		people = $('#people'),
		chatinput = $('#chatinput'),
		chatuser = $('#chatuser'),
		welcomeMsg = $('#welcomeMsg'),
		roundMsg = $('#roundMsg');

	//Updates status on connection
	socket.on('connect', function() {
		status.text('');
		status.append('Doodle<b>Chat</b>');
		wordtodraw.text('Word: ');
		pointDisplay.text('---');
		chatinput.removeProp('disabled');
		chatuser.removeProp('disabled');
		chatinput.focus();
		welcomeMsg.fadeIn(1000);
	});

	//Updates user list along with score
	socket.on('users', function (users) {
		people.text('');
		people.append('<p><b>Current Players</b></p>');
		for (var i in users) {
			people.append('<p>' + users[i].score + ' || <span style="color:' +
				users[i].color + '">' + users[i].name + '</span></p>');
		}
	});

	/**
	 *  *************************
	 *    Chatting Section Code
	 *  *************************
	 */

	 var chatcontent = $('#chatcontent'),
	 	 name = "New Player";

	 //Enter key sends message
	 chatinput.keydown(function(e) {
	 	if (e.keyCode === 13) {
	 		sendMessage();
	 	}
	 });

	 //Enter key changes name
	  chatuser.keydown(function(e) {
	 	if (e.keyCode === 13) {
	 		nameChange();
	 	}
	 });

	 //Sends message, can also clear chat content
	 function sendMessage() {
	 	var msg = chatinput.val();

	 	if (!msg) {
	 		return;
	 	}

	 	if (msg == 'clear') {
	 		chatcontent.text('');
	 		chatinput.val('');
	 		return;
	 	}

	 	if (name != chatuser.val()) {
	 		nameChange();
	 	}

	 	socket.emit('message', { text: msg, points: points });
	 	chatinput.val('');
	 }

	 //Changes name of user
	 function nameChange() {
	 	var newName = chatuser.val();
	 	if (!newName || newName == name) {
	 		return;
	 	}

	 	socket.emit('nameChange', { name: newName });
	 	name = newName;
	 }

	 //Update chatcontent with new message
	 socket.on('message', function(msg) {
		chatcontent.append('<p><b><span style="color:' + msg.color + '">' + msg.name + ':</span></b> ' + msg.text + '</p>');
		chatScrollDown();
	});

	socket.on('userConnect', function (user) {
		chatcontent.append('<p>&raquo; <span style="color:' + user.color + '">' + user.name + '</span> joined Doodle Chat!</p>');
		chatScrollDown();
	});

	socket.on('disconnect', function (user) {
		chatcontent.append('<p>&raquo; Come back soon <span style="color:' + user.color + '">' + user.name + '</span>!</p>');
		chatScrollDown();
	});
	
	socket.on('nameChange', function (user) {
		chatcontent.append('<p>&raquo; <span style="color:' + user.color + '">' + user.oldName + '</span> changed his name to <span style="color:' + user.color + '">' + user.newName + '</span></p>');
		chatScrollDown();
	});

	function chatScrollDown() {
		chatcontent.scrollTop(chatcontent[0].scrollHeight);
	};

	/**
	 *  *************************
	 *    Drawing Section Code
	 *  *************************
	 */

	var canvas = $('#canvas'),
		clearcanvas = $('#clearcanvas'),
		selectedcolor = $('.color'),
		start = $('#start'),
		wordtodraw = $('#wordtodraw'),
		pointDisplay = $('#points'),
		timeleft = 90,
		drawingTimer = null,
		context = canvas[0].getContext('2d'),
		lastpoint = null,
		painting = false,
		myturn = false;
		myword = '';
		points = 100;

	socket.on('draw', draw);

	function draw(line) {
	 	context.lineJoin = 'round';
		context.lineWidth = 2;
		context.strokeStyle = line.color;
		context.beginPath();
		
		if (line.from) {
			context.moveTo(line.from.x, line.from.y);
		} else {
			context.moveTo(line.to.x-1, line.to.y);
		}
		
		context.lineTo(line.to.x, line.to.y);
		context.closePath();
		context.stroke();
	}

	 // Disable text selection on the canvas
	canvas.mousedown(function () {
		welcomeMsg.fadeOut();
		return false;
	});

	$(document).mousedown(function() {
		welcomeMsg.fadeOut();
	});
	
	canvas.mousedown(function(e) {
		if(myturn) {
			painting = true;
			var newpoint = { x: e.pageX - this.offsetLeft, y: e.pageY - this.offsetTop},
				line = { from: null, to: newpoint, color: selectedcolor.val() };
			
			draw(line);
			lastpoint = newpoint;
			socket.emit('draw', line);
		}
	});
	
	canvas.mousemove(function(e) {
		if(myturn && painting) {
			var newpoint = { x: e.pageX - this.offsetLeft, y: e.pageY - this.offsetTop},
				line = { from: lastpoint, to: newpoint, color: selectedcolor.val() };
			
			draw(line);
			lastpoint = newpoint;
			socket.emit('draw', line);
		}
	});
	
	canvas.mouseout(function(e) {
		painting = false;
	});
	
	canvas.mouseup(function(e) {
		painting = false;
	});
	
	socket.on('drawCanvas', function(canvasToDraw) {
		if(canvasToDraw) {
			canvas.width(canvas.width());
			context.lineJoin = 'round';
			context.lineWidth = 2;
			
			for(var i=0; i < canvasToDraw.length; i++)
			{		
				var line = canvasToDraw[i];
				context.strokeStyle = line.color;
				context.beginPath();
				if(line.from){
					context.moveTo(line.from.x, line.from.y);
				}else{
					context.moveTo(line.to.x-1, line.to.y);
				}
				context.lineTo(line.to.x, line.to.y);
				context.closePath();
				context.stroke();
			}
		}
	});
	
	clearcanvas.click(function() {
		if (myturn) {
			socket.emit('clearCanvas');
		}
	});
	
	socket.on('clearCanvas', function() {
		context.clearRect(0, 0, canvas.width(), canvas.height());
	});
	
	start.click(function() {
		socket.emit('newGame');
	});

	 // everyone can draw on canvas until game starts
	socket.on('freeDraw', function (msg) {
		wordtodraw.text('Word: ');
		pointDisplay.text('---');
		timeleft = 90;
		points = 100;
		clearInterval(drawingTimer);
		drawingTimer = null;
		myturn = true;

		status.text('');
		status.append('Doodle<b>Chat</b>');
		start.prop('value', 'Start Game');
		chatcontent.append('<p>&raquo; Currently in free draw mode! When everyone is ready, press Start Game to begin!</p>');
		chatScrollDown();
	});

	socket.on('yourTurn', function (msg) {
		myturn = true;
		myword = msg.word;

		status.text('');
		status.append('<b>Round ' + msg.round + '</b> | <b><span style="color:' + msg.color + '">' + 'You</b> are currently drawing!');
		wordtodraw.text(' Word: ' + msg.word);
		pointDisplay.text(points);
		start.prop('value', 'Pass? (' + timeleft + ')');
		drawingTimer = setInterval( timer , 1000 );
	});

	socket.on('yourGuess', function (msg) {
		myturn = false;
		status.text('');
		status.append('<b>Round</b> ' + msg.round + ' | <b><span style="color:' + msg.color + '">' + msg.name + '</span></b> is now drawing!');
		wordtodraw.text('Guess the word!');
		
		chatcontent.append('<p>&raquo; <span style="color:' + msg.color + '">' + msg.name + '</span> is now drawing!</p>');
		chatScrollDown();
		pointDisplay.text(points);
		start.prop('value', 'Timer: ' + timeleft);
		drawingTimer = setInterval( timer , 1000 );
	});

	function timer () {
		if(timeleft > 0) {
			timeleft--;

			if (timeleft % 10 == 0) {
				points -= 10;
				pointDisplay.text(points);
			}

		} else {
			timeleft = 90;
			points = 100;
			wordtodraw.text('Word: ');
			clearInterval(drawingTimer);
			drawingTimer = null;
		}
	
		if (myturn) {
			start.prop('value', 'Pass? (' + timeleft + ')');
		} else {
			start.prop('value', 'Timer: ' + timeleft);
		}
	}

	socket.on('wordGuessed', function(msg) {
		chatcontent.append('<p>&raquo; <span style="color:' + msg.color + '">' + msg.name + '</span> guessed the word (<strong>' + msg.text + '</strong>) !!!</p>');
		wordtodraw.text('Word: ');
		pointDisplay.text('---');
		chatScrollDown();
		timeleft = 90;
		points = 100;
		clearInterval(drawingTimer);
		drawingTimer = null;
	});

	socket.on('wordNotGuessed', function(msg) {
		chatcontent.append('<p>&raquo; The round is over! The word was <strong>' + msg.text + '</strong>.</p>');
		wordtodraw.text('Word: ');
		pointDisplay.text('---');
		chatScrollDown();
		timeleft = 90;
		points = 100;
		clearInterval(drawingTimer);
		drawingTimer = null;
	});

	socket.on('errorMsg', function() {
		chatcontent.append('<p>&raquo; Stop pressing my buttons & guess the word!</p>');
		chatScrollDown();
	});

	socket.on('needMorePlayers', function() {
		chatcontent.append('<p>&raquo; Wait for more players to begin!</p>');
		chatScrollDown();
	});

	socket.on('startGame', function(data) {
		roundMsg.text('');
		roundMsg.append('<h1><b>Round ' + data.round + '</b></h1>');
		roundMsg.append('<h2><b>Doodlers on Deck</b></h2>');
		for (var i = 0; i < 3; i++) {

			if (data.round == 9) {
				i += 1; // display only next 2 drawers
			} else if (data.round == 10) {
				i += 2; // display only next drawer
			}

			if (data.drawers[data.count] == null) {
				data.count = 0;
				roundMsg.append('<h3>&raquo; '+ '<span style="color:' +
				data.drawers[data.count].color + '">' + data.drawers[data.count].name + '</h3>');
			} else roundMsg.append('<h3>&raquo; ' + '<span style="color:' + 
				data.drawers[data.count].color + '">' + data.drawers[data.count].name + '</h3>');
			data.count++;
		}

		roundMsg.fadeIn(500);
		drawingTimer = setTimeout(startRound, 7000);
		chatcontent.append('<p>&raquo; Now starting round: ' + data.round + '</p>');
		chatScrollDown();	
	});

	function startRound() {
		roundMsg.fadeOut(500);
		socket.emit('startRound');
	}

	socket.on('gameOver', function(users) {
		roundMsg.text('');
		var html = '<h1>Game Over</h2>' + 
					'<h2>Our champion is ... ' + users[0].name + '</h2>' +
					'<h3>2nd Place ... ' + users[1].name + '</h3>';
		/*
		roundMsg.append('<h1>Game Over</h2>');
		roundMsg.append('<h2>Our champion is ... ' + users[0].name + '</h2>');
		roundMsg.append('<h3>2nd Place ... ' + users[1].name + '</h3>');
		
		*/
		chatcontent.append('<p>&raquo; Game Over</p>');
		chatcontent.append('<p>&raquo; Our winners are:</p>');
		chatcontent.append('<p>&raquo; 1st ... ' + users[0].name + ' with ' + users[0].score + '</p>');
		chatcontent.append('<p>&raquo; 2nd ... ' + users[1].name + ' with ' + users[1].score + '</p>');
		
		// if there is a 3 or more players
		if (users[2].name) {
			chatcontent.append('<p>&raquo; 3rd ... ' + users[2].name + ' with ' + users[2].score + '</p>');	
			html += '<h3>3rd Place ... ' + users[2].name + '</h3>';
			//roundMsg.append('<h3>3rd Place ... ' + users[2].name + '</h3>');
		}
		chatScrollDown();

		nextGameIn = '<h4>Next game starts in ' + 15 +' seconds</h4>';
		//roundMsg.append('<h4>Next game starts in ' + timeleft +' seconds</h4>');
		roundMsg.append(html + nextGameIn);
		roundMsg.fadeIn('1000');
		wait(html, 15);
		drawingTimer = setTimeout( resetGame, 150000 );
	});

	function wait(html, timeleft) {
		while (timeleft) {
			timeleft--;
			roundMsg.text('');
			var nextGameIn = '<h4>Next game starts in ' + timeleft +' seconds</h4>';
			roundMsg.append(html + nextGameIn);
		}
	}

	function resetGame() {
		roundMsg.fadeOut('2000');
		wordtodraw.text('Word: ');
		pointDisplay.text('---');
		start.prop('value', 'Start Game');
		timeleft = 90;
		points = 100;
		clearInterval(drawingTimer);
		drawingTimer = null;
	}

});




