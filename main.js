const rp = require("request-promise-native");
const { Webhook, MessageBuilder } = require('discord-webhook-node');
const config = require('./config.json');
const hook = new Webhook(config.webhook);
const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36";

let loginBody = {
    identifiant: config.identifiant,
    motDePasse: config.motDePasse
}

let jar = rp.jar();
let bearertoken = "";
let programcode = "";
let cachegrades = [];
let firstpull = true;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function notify(obj) {
    const embed = new MessageBuilder()
        .setTitle('New UQAM Grade !')
        .addField('Note', obj.note)
        .addField('Class', obj.name)
        .setFooter('Uqam Monitor')
        .setTimestamp();
        
        hook.send(embed);
}

async function login() {

    var loginOptions = {
        method: "POST",
        url: "https://portailetudiant.uqam.ca/authentification",
        body: loginBody,
        jar: jar,
        json: true,
        headers: {
            'User-Agent': ua
          }
    }
    var login = await rp(loginOptions);
    return login;
}

async function getProgramCode() {
    var programidCodeOptions = {
        method: "GET",
        url: "https://portailetudiant.uqam.ca/apis/programmeIns/identifiant",
        jar: jar,
        json: true,
        headers: {
            'User-Agent': ua,
            "Authorization": "Bearer " + bearertoken
        }
    }
    var programidbody = await rp(programidCodeOptions);
    return programidbody;
}

async function getGrades() {

    var getGradesOptions = {
        method: "GET",
        url: "https://portailetudiant.uqam.ca/apis/releve/identifiant/" + programcode + "/O",
        jar: jar,
        json: true,
        headers: {
            'User-Agent': ua,
            "Authorization": "Bearer " + bearertoken
        }
    }

    var grades = await rp(getGradesOptions);

    var allgradeobjects = [];

    var programes = grades["data"]["resultats"]["resultats"][0]["programmes"];

    programes.forEach(program => {
        program["activites"].forEach(activity => {
            allgradeobjects.push(activity);
        });
    });

    console.log("checking " + allgradeobjects.length + " classes.");
    if (firstpull == true) {
        console.log("first pull");
        firstpull = false;
    } else {
        if (JSON.stringify(cachegrades) !== JSON.stringify(allgradeobjects)) {
            cachegrades.forEach(cachedgrade => {
                allgradeobjects.forEach(grade => {
                    if (cachedgrade.titreActivite === grade.titreActivite) {
                        if (cachedgrade.note !== grade.note) {
                            console.log("NEW GRADE : " + grade.note + " " + grade.titreActivite);
                            notify({ note: grade.note, name: grade.titreActivite });
                        }
                    }
                });
            });

        } else {
            console.log("No new grades");
        }
        cachegrades = allgradeobjects;
    }
}

async function Run() {
    while (true) {
        console.log("Login !");
        var loginbody = await login();
        bearertoken = loginbody.token;
        console.log("Authentification token : " + bearertoken);
        await sleep(2000);
        var programcoderesult = await getProgramCode();
        programcode = programcoderesult["data"]["programme"][0]["code_prog"];
        console.log("Program code : " + programcode);
        await sleep(2000);

        while (true) {
            console.log("Pulling Grades");
            try {
                await getGrades();
            } catch (e) {
                console.log("Error Pulling Grades, re-doing login !");
                break;
            }
            var randdelay = Math.floor(Math.random() * 60000); 
            console.log(randdelay + " seconds delay ...");
            await sleep(randdelay);
        }
    }
}

Run();