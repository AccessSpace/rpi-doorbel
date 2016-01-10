var app = require('http').createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');
//var Gmailer = require("gmail-sender");
var Sound = require('node-aplay');
var BellSound = new Sound("./audio/sound1.wav");
var OnlineSound = new Sound("./audio/alert.wav");

app.listen(80);

//{27:"Red LED", 17:"Amber LED", 4:"Green LED", 22:"Output A", 23:"Output B", 24:"Output C", 25:"Output D", 18: "Buzzer"}
//{11:"Red Button", 9:"Input A", 7:"Input B", 8:"Input C", 10:"Input D"}
//PB_PIN_BUZZER = 18
//https://www.npmjs.com/package/sms

var iRepeatTrigger = 3;
//Times in milliseconds
var iRepeatTimeout = 60 * 1000;
var iDebounceTime = 2000;
var aPresses = [];

/*//TODO : Move these options into a config file
Gmailer.options({
	smtp: {
		service: "Gmail",
	}
});
*/

//These are the PiBrela Pins
var Gpio = require('onoff').Gpio,
  led = new Gpio(27, 'out'),
  button = new Gpio(11, 'in', 'rising'),
  inputA = new Gpio(9, 'in', 'rising'),
  inputB = new Gpio(7, 'in', 'rising');

//Webserver to serve the static page with the notifications script on
function handler (req, res) {
	fs.readFile(__dirname + '/index.html',
		function (err, data) {
			if (err) {
				res.writeHead(500);
				return res.end('Error loading index.html');
			}

			res.writeHead(200);
			res.end(data);
		}
	);
}

//Tidy up on exit 
process.on('SIGINT', function(){
	process.exit();
});


//When socket connected
io.on('connection', function (socket) {
	socket.emit('hookedup', {time:Date.now() });
	
	socket.on('clientonline', function (data) {
		console.log('client online');
		//Need to check we aren't playing sound more than once
		//OnlineSound.play();
	});
	
	//Can revieve a bell from clients so we could set up a repeater or even have a recorded someone is coming
	socket.on('bell', function (data) {
		console.log('received bell');
		//Need to check we aren't playing sound more than once
		BellSound.play();
	});
});
 
var onPress = function(err, value, buttonid) { 
	// IDEA : Sound buzzer : will need a different io library for minute using speakers
	var iCurrTime = Date.now();
	console.log('iCurrTime', iCurrTime);
	
	//Debounce
	if(aPresses.length > 0) {
		console.log("aPresses.length",aPresses.length);
		if (iCurrTime < (aPresses[aPresses.length - 1] + iDebounceTime) ) {
			console.log("too quick");
			return false;
		}
	}
	
	//Filters out presses that happened too long ago to be considered part of this attempt
	aPresses = aPresses.filter(function(iOldTime){
		return iOldTime >= (iCurrTime - iRepeatTimeout);
	});
	
	console.log('aPresses', aPresses);
	
	//Playing more than once causes a chrash so need to check if playing
	BellSound.play();
	io.emit('doorbell', { button: buttonid });
	
	//Record Button press
	aPresses.push(iCurrTime);
	console.log('aPresses new', aPresses);
	
	//TODO : if X times in Y seconds check day and loop through email/mobile numbers to message		
	if(aPresses.length >= iRepeatTrigger) {
		var sSubject = "Access Space Doorbell - "+buttonid+" Activated";
		console.log("Sending ", sSubject); 
		/*Gmailer.send({
			subject: sSubject,
			template: "./doorbell-email.html",
			from: "'Gmail Sender'",
			to: {
				email: "martyn.eggleton@gmail.com",
				name: "Martyn",
				surname: "Eggleton"
			},
			data: {
				subject: sSubject,
				name: "Martyn",
				presses: aPresses.length,
				limit: iRepeatTimeout / 1000,
				starttime : aPresses[0],
				emaillist: "",
				smslist: "",
			}
		});
		*/
		aPresses = [];
	}
} 

button.watch(function(err, value) { 
	onPress(err, value, "Test Button");
});

inputA.watch(function(err, value) { 
	onPress(err, value, "Front Door");
});

inputB.watch(function(err, value) { 
	onPress(err, value, "Main Area Door");
});

//maybe hook to promises
//console.log("Started");
