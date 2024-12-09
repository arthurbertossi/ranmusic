require('dotenv').config();
const { Client, Intents, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const queue = new Map(); // A fila de músicas
const PREFIX = '!'; // Prefixo dos comandos

client.once('ready', () => {
    console.log(`${client.user.tag} está online!`);
});

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    const serverQueue = queue.get(message.guild.id);

    if (command === 'p' || command === 'play') {
        const url = args[0];
        if (!url || !ytdl.validateURL(url)) {
            return message.channel.send('Por favor, forneça um link válido do YouTube!');
        }
        
        const songInfo = await ytdl.getInfo(url);
        const song = {
            title: songInfo.videoDetails.title,
            url: songInfo.videoDetails.video_url,
        };

        if (!serverQueue) {
            const queueConstruct = {
                textChannel: message.channel,
                voiceChannel: null,
                connection: null,
                songs: [],
                player: createAudioPlayer(),
                timeout: null,
            };

            queue.set(message.guild.id, queueConstruct);
            queueConstruct.songs.push(song);

            try {
                const voiceChannel = message.member.voice.channel;
                if (!voiceChannel) return message.channel.send('Entre em um canal de voz primeiro!');

                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });

                queueConstruct.voiceChannel = voiceChannel;
                queueConstruct.connection = connection;

                playSong(message.guild, queueConstruct.songs[0]);
            } catch (err) {
                console.error(err);
                queue.delete(message.guild.id);
                return message.channel.send('Ocorreu um erro ao tentar se conectar ao canal de voz.');
            }
        } else {
            serverQueue.songs.push(song);
            return message.channel.send(`${song.title} foi adicionada à fila!`);
        }
    } else if (command === 's' || command === 'stop') {
        if (!serverQueue) return message.channel.send('Não há músicas na fila para pular!');
        serverQueue.player.stop();
    } else if (command === 'q' || command === 'quit') {
        if (!serverQueue) return message.channel.send('Não há músicas para parar.');
        serverQueue.songs = [];
        serverQueue.player.stop();
        serverQueue.connection.destroy();
        queue.delete(message.guild.id);
        return message.channel.send('Serviço encerrado!');
    } else if (command === 'pause') {
        if (serverQueue.player.state.status === AudioPlayerStatus.Playing) {
            serverQueue.player.pause();
            return message.channel.send('Para para para tudo!');//Música pausada
        } else {
            return message.channel.send('ta pausando oque fio?');//Não há música tocando para pausar.
        }
    }
});

function playSong(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        serverQueue.timeout = setTimeout(() => {
            serverQueue.connection.destroy();
            queue.delete(guild.id);
            serverQueue.textChannel.send('Mem deixarao sozinho.');//Saindo por inatividade
        }, 7 * 60 * 1000); // 7 minutos
        return;
    }
    const stream = ytdl(song.url, {
        filter: 'audioonly',
        requestOptions: {
            headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        },
    });
    const resource = createAudioResource(stream);

    serverQueue.player.play(resource);
    serverQueue.connection.subscribe(serverQueue.player);

    serverQueue.player.on(AudioPlayerStatus.Idle, () => {
        serverQueue.songs.shift();
        playSong(guild, serverQueue.songs[0]);
    });

    serverQueue.textChannel.send(`Playando: **${song.title}**`);//Tocando agora
}

client.login(process.env.BOT_TOKEN);
