/* Server Side Code */

var express = require("express"),
	app = express(),
	io = require('socket.io').listen(app.listen(8080)),
	fs = require('fs'),
	sanitizer = require('sanitizer');

var users = [], canvas = [], drawCycle = [];

var	wordBank, 
	currentWord, 
	currentPlayer = 0,
	drawingTimer,
	points = 100,
	gameStarted = false, 
	round = 1,
	drawCounter = 0;

app.use(express.static(__dirname + '/client'));
app.get("/", function (req, res) {
	res.render("index.html");
});

fs.readFile(__dirname + '/doodlechatwords.txt', function (err, data) {
	wordBank = data.toString('utf-8').split('\r\n');
});

io.sockets.on('connection', function (socket) {
	var name = 'New Player',
		fontColor = rndColor();
		score = 0;

	// adding new user & updating his/her canvas
	users.push( { id: socket.id, name: name, color: fontColor, score: score }); 
	drawCycle.push( { id: socket.id, name: name, color: fontColor });
	io.sockets.emit('userConnect', { name: name, color: fontColor }); 
	io.sockets.emit('users', users);
	io.sockets.emit('drawCanvas', canvas);

	/**
	 *  *************************
	 *    Chatting Section Code
	 *  *************************
	 */

	 if (!gameStarted) {
	 	resetGame();
	 }

	 if (users.length < 1) {
	 	resetGame();
	 }

	 // cleans msg, and checks if it is the guessed word
	 socket.on('message', function (msg) {
	 	var saniMsg = sanitizer.sanitize(msg.text);

	 	if (saniMsg != msg.text) {
	 		console.log('(!) Invalid text sent from ' + socket.id + '(' + name + ') : ' + msg.text);		
	 	}
	 	if (!saniMsg || saniMsg.length>256) {
	 		return;
	 	}

	 	io.sockets.emit('message', { text: saniMsg, color: fontColor, name: name });

	 	if (gameStarted && currentPlayer != socket.id) {
	 		if (saniMsg.toLowerCase().trim() == currentWord) {
	 			io.sockets.emit('wordGuessed', { text: currentWord, color: fontColor, name: name, guesser: socket.id, drawer: currentPlayer });			
			
				// add points for users
				for(var i = 0; i<users.length; i++) {
					if(users[i].id == socket.id || users[i].id == currentPlayer) {
						users[i].score += msg.points;
					}
				}

				// turn off drawing timer
				clearTimeout(drawingTimer);
				drawingTimer = null;

				// sort users
				sortUsersByScore();
				io.sockets.emit('users', users);

				nextRound();
	 		}
	 	}
	});


	// user change name event
	socket.on('nameChange', function (user) {
		var saniName = sanitizer.sanitize(user.name);
		if (saniName != user.name) {
			console.log('(!) Invalid name given by ' + socket.id + ' (' + myNick + ') : ' + user.nick);
		}
		if(!saniName || name == saniName || saniName.length>32 ) {
			return;
		}

		io.sockets.emit('nameChange', { newName: saniName, oldName: name, color: fontColor });
		name = saniName;
		
		for(var i = 0; i<users.length; i++) {
			if(users[i].id == socket.id) {
				users[i].name = name;
				break;
			}
		}

		for(var i = 0; i<drawCycle.length; i++) {
			if(drawCycle[i].id == socket.id) {
				drawCycle[i].name = name;
				break;
			}
		}
		// update user list
		io.sockets.emit('users', users);
	});

	// user disconnection event 
	socket.on('disconnect', function () {
		socket.broadcast.emit('disconnect', { name: name, color: fontColor });
		for(var i = 0; i<users.length; i++) {
			if(users[i].id == socket.id) {
				users.splice(i,1);
				break;
			}
		}

		for(var i = 0; i<drawCycle.length; i++) {
			if(drawCycle[i].id == socket.id) {
				drawCycle.splice(i, 1);
				break;
			}
		}

		
		io.sockets.emit('users', users);
		
		// if player leaves and total players < 1
		if (users.length < 1) {
			clearTimeout(drawingTimer);
			resetGame();
			io.sockets.emit('wordNotGuessed', { text: currentWord });
			io.sockets.emit('needMorePlayers');
		}

		// if current player leaves
		if(currentPlayer == socket.id) {
			// turn off drawing timer
			clearTimeout(drawingTimer);
			turnFinished();
		}

		

	});

	function rndColor() {
		var color = '#'+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6);
		return color;
	};

	function sortUsersByScore() {
		users.sort(function(a,b) { return parseFloat(b.score) - parseFloat(a.score) } );
	}

	/**
	 *  *************************
	 *    Drawing Section Code
	 *  *************************
	 */
	socket.on('draw', function (line) {
		if (!gameStarted) {
			canvas.push(line);
			io.sockets.emit('draw', line);
		}

		if(currentPlayer == socket.id) {
			canvas.push(line);
			io.sockets.emit('draw', line);
		}
	});

	socket.on('clearCanvas', function () {
		if (!gameStarted) {
			canvas.splice(0, canvas.length);
			io.sockets.emit('clearCanvas');
		}

		if(currentPlayer == socket.id) {
			canvas.splice(0, canvas.length);
			io.sockets.emit('clearCanvas');
		}
	});

	socket.on('newGame', function () {
		// check for number of players & if game already started
		if (gameStarted) {
			
			if (currentPlayer == socket.id) {
				clearTimeout(drawingTimer);
				turnFinished();
			} else socket.emit('errorMsg');

		} else if (users.length > 1 && !gameStarted) {
			gameStarted = true;
			currentPlayer = drawCycle[drawCounter].id; // first person in room starts
			io.sockets.emit('startGame', { round: round, drawers: drawCycle, count: drawCounter });	
		} else {
			io.sockets.emit('needMorePlayers');
		}
	});

	socket.on('startRound', function () {
		if (currentPlayer == socket.id && round < 11) {
			io.sockets.emit('clearCanvas');

			var random = Math.floor(Math.random() * wordBank.length),
				line = wordBank[random],
				word = line;

			currentWord = word;
			socket.emit('yourTurn', { color: fontColor, word: currentWord, round: round });
			socket.broadcast.emit('yourGuess', { color: fontColor, name: name, round: round });
			round++;

			drawingTimer = setTimeout( turnFinished, 90000 );
		}
	});

	socket.on('readyToDraw', function () {
		if (!currentPlayer) {
			currentPlayer = socket.id;
			io.sockets.emit('clearCanvas');

			var random = Math.floor(Math.random() * wordBank.length),
				line = wordBank[random],
				word = line;

			currentWord = word;
			socket.emit('yourTurn', word);
			socket.broadcast.emit('friendDraw', { color: fontColor, name: name } );

			drawingTimer = setTimeout( turnFinished, 90000 );	
		} else if (currentPlayer == socket.id) {
			clearTimeout(drawingTimer);
			turnFinished();
		}
	});

	function turnFinished() {
		drawingTimer = null;
		io.sockets.emit('wordNotGuessed', { text: currentWord });
		if (users.length > 1)
			nextRound();
		else {
			resetGame();
			io.sockets.emit('needMorePlayers');
			io.sockets.emit('freeDraw');
		}
	}

	function nextRound() {
		if (drawCounter < users.length - 1) {
			drawCounter++;
		} else {
			drawCounter = 0;
		}

		currentPlayer = drawCycle[drawCounter].id;
		if (round < 11) 
			io.sockets.emit('startGame', { round: round, drawers: drawCycle, count: drawCounter });
		else {
			io.sockets.emit('gameOver', users);
			resetGame();
		}
	}

	function resetGame() {
		drawingTimer = null;
		round = 1;
		drawCounter = 0;
		gameStarted = false;
		currentPlayer = null;
		io.sockets.emit('freeDraw');
	}
});


