--
-- PostgreSQL database dump
--

\restrict 7v5qeYuJlTEV9ol71NtGOUjPABzaustvdIvfpPYXS81UzygPxpCuTVvKR7QmFks

-- Dumped from database version 16.13 (Debian 16.13-1.pgdg13+1)
-- Dumped by pg_dump version 16.13 (Debian 16.13-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE ONLY public.user_mix_preferences DROP CONSTRAINT "FK_a9affaad17d70b22e017553d896";
ALTER TABLE ONLY public.listen_history DROP CONSTRAINT "FK_a56c8e49a0310e5804c4ccba3e7";
ALTER TABLE ONLY public.playlists DROP CONSTRAINT "FK_a3ea169575c25e5c55494d7f382";
ALTER TABLE ONLY public.users DROP CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1";
ALTER TABLE ONLY public.playlist_tracks DROP CONSTRAINT "FK_7ef165e08a3b87eae8cf4275cda";
ALTER TABLE ONLY public.track_tags DROP CONSTRAINT "FK_67febdcc6d9fdda82f343b9e72d";
ALTER TABLE ONLY public.clips DROP CONSTRAINT "FK_64dabc2724586a260ce3c893208";
ALTER TABLE ONLY public.favorite_tracks DROP CONSTRAINT "FK_3af7a3ee5333d4db9a85133b87a";
ALTER TABLE ONLY public.clips DROP CONSTRAINT "UQ_a933e0e6838502aca375a9de71f";
ALTER TABLE ONLY public.users DROP CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3";
ALTER TABLE ONLY public.clips DROP CONSTRAINT "PK_cdb959a37f95935a5d30460dc3c";
ALTER TABLE ONLY public.roles DROP CONSTRAINT "PK_c1433d71a4838793a49dcad46ab";
ALTER TABLE ONLY public.listen_history DROP CONSTRAINT "PK_a843bc2e94502f8432de79783c3";
ALTER TABLE ONLY public.playlists DROP CONSTRAINT "PK_a4597f4189a75d20507f3f7ef0d";
ALTER TABLE ONLY public.users DROP CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433";
ALTER TABLE ONLY public.favorite_tracks DROP CONSTRAINT "PK_8d34ad5c55c7d5448fad8c4ced7";
ALTER TABLE ONLY public.track_tags DROP CONSTRAINT "PK_82814b03a02ca7574af95674114";
ALTER TABLE ONLY public.user_mix_preferences DROP CONSTRAINT "PK_65c479fd39a549e4bef426e357b";
ALTER TABLE ONLY public.playlist_tracks DROP CONSTRAINT "PK_0f93b1a2df4de2e5b48c1459617";
ALTER TABLE public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.user_mix_preferences ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.track_tags ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.roles ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.playlists ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.playlist_tracks ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.listen_history ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.favorite_tracks ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.clips ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE public.users_id_seq;
DROP TABLE public.users;
DROP SEQUENCE public.user_mix_preferences_id_seq;
DROP TABLE public.user_mix_preferences;
DROP SEQUENCE public.track_tags_id_seq;
DROP TABLE public.track_tags;
DROP SEQUENCE public.roles_id_seq;
DROP TABLE public.roles;
DROP SEQUENCE public.playlists_id_seq;
DROP TABLE public.playlists;
DROP SEQUENCE public.playlist_tracks_id_seq;
DROP TABLE public.playlist_tracks;
DROP SEQUENCE public.listen_history_id_seq;
DROP TABLE public.listen_history;
DROP SEQUENCE public.favorite_tracks_id_seq;
DROP TABLE public.favorite_tracks;
DROP SEQUENCE public.clips_id_seq;
DROP TABLE public.clips;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: clips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clips (
    id integer NOT NULL,
    track_id character varying NOT NULL,
    title character varying NOT NULL,
    artist character varying NOT NULL,
    thumbnail_url character varying,
    start_time integer NOT NULL,
    end_time integer NOT NULL,
    short_code character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id integer
);


--
-- Name: clips_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clips_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clips_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clips_id_seq OWNED BY public.clips.id;


--
-- Name: favorite_tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorite_tracks (
    id integer NOT NULL,
    track_id character varying NOT NULL,
    title character varying NOT NULL,
    artist character varying NOT NULL,
    thumbnail_url character varying,
    duration integer,
    added_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id integer
);


--
-- Name: favorite_tracks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.favorite_tracks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: favorite_tracks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.favorite_tracks_id_seq OWNED BY public.favorite_tracks.id;


--
-- Name: listen_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listen_history (
    id integer NOT NULL,
    track_id character varying NOT NULL,
    title character varying NOT NULL,
    artist character varying NOT NULL,
    thumbnail_url character varying,
    listened_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id integer
);


--
-- Name: listen_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.listen_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: listen_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.listen_history_id_seq OWNED BY public.listen_history.id;


--
-- Name: playlist_tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.playlist_tracks (
    id integer NOT NULL,
    track_id character varying NOT NULL,
    title character varying NOT NULL,
    artist character varying NOT NULL,
    thumbnail_url character varying,
    duration integer,
    added_at timestamp without time zone DEFAULT now() NOT NULL,
    playlist_id integer
);


--
-- Name: playlist_tracks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.playlist_tracks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: playlist_tracks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.playlist_tracks_id_seq OWNED BY public.playlist_tracks.id;


--
-- Name: playlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.playlists (
    id integer NOT NULL,
    name character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id integer
);


--
-- Name: playlists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.playlists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: playlists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.playlists_id_seq OWNED BY public.playlists.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying NOT NULL
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: track_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.track_tags (
    id integer NOT NULL,
    track_id character varying NOT NULL,
    title character varying NOT NULL,
    artist character varying NOT NULL,
    thumbnail_url character varying,
    tag character varying NOT NULL,
    added_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id integer
);


--
-- Name: track_tags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.track_tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: track_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.track_tags_id_seq OWNED BY public.track_tags.id;


--
-- Name: user_mix_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_mix_preferences (
    id integer NOT NULL,
    slots jsonb NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id integer
);


--
-- Name: user_mix_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_mix_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_mix_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_mix_preferences_id_seq OWNED BY public.user_mix_preferences.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying NOT NULL,
    email character varying NOT NULL,
    password_hash character varying NOT NULL,
    is_blocked boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    role_id integer
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: clips id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clips ALTER COLUMN id SET DEFAULT nextval('public.clips_id_seq'::regclass);


--
-- Name: favorite_tracks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_tracks ALTER COLUMN id SET DEFAULT nextval('public.favorite_tracks_id_seq'::regclass);


--
-- Name: listen_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listen_history ALTER COLUMN id SET DEFAULT nextval('public.listen_history_id_seq'::regclass);


--
-- Name: playlist_tracks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_tracks ALTER COLUMN id SET DEFAULT nextval('public.playlist_tracks_id_seq'::regclass);


--
-- Name: playlists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlists ALTER COLUMN id SET DEFAULT nextval('public.playlists_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: track_tags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_tags ALTER COLUMN id SET DEFAULT nextval('public.track_tags_id_seq'::regclass);


--
-- Name: user_mix_preferences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_mix_preferences ALTER COLUMN id SET DEFAULT nextval('public.user_mix_preferences_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: clips; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clips (id, track_id, title, artist, thumbnail_url, start_time, end_time, short_code, created_at, user_id) FROM stdin;
1	B_HSa1dEL9s	For Whom The Bell Tolls (Remastered)	Metallica	https://i.ytimg.com/vi/B_HSa1dEL9s/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCH_Zm-jMudQwse7HgA9iD2K3ruBQ	0	97	585631ed488c	2026-03-23 06:58:31.526849	2
2	TmF6oFbglBY	Lashed To the Slave Stick	Nile	https://i.ytimg.com/vi/TmF6oFbglBY/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	59	104	178bc0e1e881	2026-05-05 16:06:51.596874	2
3	v2AC41dglnM	AC/DC - Thunderstruck (Official Video)	AC/DC	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2Fv2AC41dglnM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLB3h9kpQx4cInRC0ds_cSXp2GvoTg	164	235	89ad5eb97a66	2026-05-07 10:21:20.830623	2
4	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	83	84	2345a72a8675	2026-05-07 13:54:04.807308	2
5	TmF6oFbglBY	Lashed To the Slave Stick	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTmF6oFbglBY%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	35	109	154cb7789224	2026-05-07 14:35:57.369092	2
38	iVvXB-Vwnco	Silvera#1	Gojira	/clip-cover.svg	78	118	8bd5da5868e3	2026-05-07 16:24:56.553403	2
39	iVvXB-Vwnco	Silvera	Gojira	/clip-cover.svg	79	138	fb7bb28326a5	2026-05-07 16:25:43.264246	2
40	TnRZhLRv6eM	testyy	Slayer	/clip-cover.svg	170	239	93cbdd02ec52	2026-05-07 16:26:27.701316	2
41	FIjovoSjgH4	If Darkness Had a Son	Metallica	/clip-cover.svg	22	30	089b56648d4c	2026-05-07 16:28:18.149115	2
42	CE_IV8a80ow	Dragon's Dance	Erick Aleixo	/clip-cover.svg	0	30	9d61f0d0a81d	2026-05-07 16:29:49.014605	2
43	FIjovoSjgH4	If Darkness Had a Son	Metallica	/clip-cover.svg	23	30	2cb0b0fdc9cf	2026-05-07 17:02:01.88435	2
44	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/clip-cover.svg	44	79	00eab4697017	2026-05-07 17:55:41.570603	2
45	clip:00eab4697017	Rammstein - Du Hast (Official 4K Video)	Rammstein	/clip-cover.svg	12	23	257668d9dd06	2026-05-07 17:56:16.20183	2
46	TnRZhLRv6eM	Angel Of Death	Slayer	/clip-cover.svg	134	159	69eb67c1ec8e	2026-05-07 17:57:02.478815	2
47	jqnC54vbUbU	tests	Slayer	/clip-cover.svg	123	173	c4f5f664082e	2026-05-07 17:57:40.947547	2
48	TnRZhLRv6eM	Angel Of Death	Slayer	/clip-cover.svg	135	161	225545b3a264	2026-05-07 18:33:18.894183	2
49	TnRZhLRv6eM	Angel Of Death	Slayer	/clip-cover.svg	100	166	4257fef20901	2026-05-07 18:33:37.946745	2
50	TnRZhLRv6eM	cxcxcx	Slayer	/clip-cover.svg	129	166	85106b0c850a	2026-05-07 18:34:13.502405	2
51	TnRZhLRv6eM	1clip	Slayer	/clip-cover.svg	156	198	ec2e85223549	2026-05-07 18:59:05.89608	2
52	3mbvWn1EY6g	Ace of Spades	Motörhead	/clip-cover.svg	109	118	5a3127be9b88	2026-05-07 19:09:48.466202	2
53	FIjovoSjgH4	If Darkness Had a Sonkjhgyft	Metallica	/clip-cover.svg	26	34	67c4e0449db7	2026-05-07 19:28:41.20556	2
54	TnRZhLRv6eM	"1	Slayer	/clip-cover.svg	178	184	977e5600c27d	2026-05-07 19:34:23.064243	2
55	iVvXB-Vwnco	koool	Gojira	/clip-cover.svg	161	173	60c448caa3b6	2026-05-07 20:05:26.430547	2
88	FIjovoSjgH4	0987	Metallica	/clip-cover.svg	19	40	3548ff1e3716	2026-05-08 14:42:01.600696	2
89	Gvyq6xYPwos	cvv	Slayer	/clip-cover.svg	32	37	3c2922c0c495	2026-05-08 14:55:09.557924	2
90	FNdC_3LR2AI	cvbnfgfdhf	Gojira	/clip-cover.svg	145	156	404cb6ab46d4	2026-05-08 14:57:13.354282	2
91	DECp8LKurKs	,cmlknjbhv	Slayer	/clip-cover.svg	175	199	d6dd046dc4d8	2026-05-08 15:02:40.213856	2
92	Gvyq6xYPwos	mknjbhvjghfdg	Slayer	/clip-cover.svg	144	150	79797431b0b4	2026-05-08 15:27:17.958647	2
93	Gvyq6xYPwos	cover	Slayer	/clip-cover.svg	56	57	0a38cce6b45e	2026-05-08 15:30:54.880213	2
94	Gvyq6xYPwos	vxbchj	Slayer	/clip-cover.svg	0	30	4f6f1e412fda	2026-05-08 15:31:22.778907	2
95	Gvyq6xYPwos	fdsgfdhdfj	Slayer	/clip-cover.svg	105	106	b77c6b5aba57	2026-05-08 15:33:01.940771	2
96	Gvyq6xYPwos	nmb	Slayer	/clip-cover.svg	111	112	5f9fcd8e26aa	2026-05-08 15:34:15.563571	2
97	Gvyq6xYPwos	vfbfd	Slayer	/clip-cover.svg	95	117	b89ae4c6e244	2026-05-08 16:37:18.753089	2
98	iVvXB-Vwnco	Gojira - Silvera [OFFICIAL VIDEO]	Gojira	/clip-cover.svg	0	214	f7b75db40c93	2026-05-08 17:30:56.02442	2
99	i2r9-Aa-FiE	Wing and A Prayer,mnb	Tim Mosher	/clip-cover.svg	73	112	d372b9e66627	2026-05-08 20:35:03.969678	13
100	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/clip-cover.svg	72	73	48f909bec530	2026-05-09 21:29:25.719327	2
101	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/clip-cover.svg	57	58	cd5bc0e2a3eb	2026-05-09 21:32:51.014599	2
\.


--
-- Data for Name: favorite_tracks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.favorite_tracks (id, track_id, title, artist, thumbnail_url, duration, added_at, user_id) FROM stdin;
13	9HZ_tx8aWuA	Fade To Black (Remastered)	Metallica	https://i.ytimg.com/vi/9HZ_tx8aWuA/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLChJWqf2IT4-F9k7wEfz3EuUYJYdQ	418	2026-04-03 10:57:45.299129	3
14	B_HSa1dEL9s	For Whom The Bell Tolls (Remastered)	Metallica	https://i.ytimg.com/vi/B_HSa1dEL9s/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCH_Zm-jMudQwse7HgA9iD2K3ruBQ	310	2026-04-03 10:57:46.101005	3
15	vA1nlwTbCvg	Battery	Metallica	https://yt3.googleusercontent.com/YArfdE0OKeDbWBrrps0MPrrVEzkMwu-SmUiDQV7VbfaS1eSqhA29i_IkD3RnTuG_g9MrlQQBbjCugZN0=w544-h544-l90-rj	313	2026-04-03 11:05:13.983454	3
24	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	246	2026-04-26 21:33:44.252099	2
1	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	272	2026-03-22 12:33:07.064391	2
29	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	\N	2026-05-07 13:54:22.60199	2
40	clip:d372b9e66627	Wing and A Prayer,mnb	Tim Mosher	/clip-cover.svg	39	2026-05-08 20:35:19.285437	13
41	clip:d6dd046dc4d8	,cmlknjbhv	Slayer	/clip-cover.svg	24	2026-05-09 19:20:41.366922	2
\.


--
-- Data for Name: listen_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.listen_history (id, track_id, title, artist, thumbnail_url, listened_at, user_id) FROM stdin;
1	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-03-22 12:02:21.664557	2
2	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-03-22 12:30:37.806741	2
3	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-22 12:34:53.134504	2
4	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-22 12:35:30.613054	2
5	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-22 12:35:32.102094	2
6	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-22 12:36:44.396022	2
7	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-03-22 13:00:38.34556	2
8	B_HSa1dEL9s	For Whom The Bell Tolls (Remastered)	Metallica	https://i.ytimg.com/vi/B_HSa1dEL9s/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCH_Zm-jMudQwse7HgA9iD2K3ruBQ	2026-03-22 13:04:35.509274	2
9	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-03-22 13:11:19.256625	2
10	r6qt_70iGk4	Fallout - Soundtrack - "Metallic Monks" (Lost Hills)	owl95	https://i.ytimg.com/vi/r6qt_70iGk4/hq720.jpg?sqp=-oaymwE2COgCEMoBSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB_gmAAtAFigIMCAAQARh_IDkoEzAP&rs=AOn4CLAntWL7rSYNDdOUj8xRQxsfDgpnew	2026-03-22 13:11:38.585555	2
11	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-03-22 13:11:40.741654	2
12	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-03-22 13:27:36.898905	2
13	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-03-22 13:33:41.724558	2
14	B_HSa1dEL9s	For Whom The Bell Tolls (Remastered)	Metallica	https://i.ytimg.com/vi/B_HSa1dEL9s/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCH_Zm-jMudQwse7HgA9iD2K3ruBQ	2026-03-23 06:57:35.728446	2
15	B_HSa1dEL9s	For Whom The Bell Tolls (Remastered)	Metallica	https://i.ytimg.com/vi/B_HSa1dEL9s/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCH_Zm-jMudQwse7HgA9iD2K3ruBQ	2026-03-29 10:55:04.618144	2
16	9HZ_tx8aWuA	Fade To Black (Remastered)	Metallica	https://i.ytimg.com/vi/9HZ_tx8aWuA/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLChJWqf2IT4-F9k7wEfz3EuUYJYdQ	2026-03-29 11:40:37.640655	2
17	kKq_6mp7SfM	Metallica - Beyond Magnetic [ FULL ALBUM ]	Metallica Music	https://i.ytimg.com/vi/kKq_6mp7SfM/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBCgM7me1qWVgxLezohIToWkj6s_w	2026-03-29 12:18:18.444999	2
18	DqDeH3hwxfw	Metallica- Black album (Full album)	DenBesteDubbenEver	https://i.ytimg.com/vi/DqDeH3hwxfw/hq720.jpg?sqp=-oaymwE2COgCEMoBSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB_gmAAtAFigIMCAAQARhoIGgoaDAP&rs=AOn4CLBcdJpzGZrHTEe8a_9mIt69Zw2r9g	2026-03-29 12:18:34.749564	2
19	9HZ_tx8aWuA	Fade To Black (Remastered)	Metallica	https://i.ytimg.com/vi/9HZ_tx8aWuA/hqdefault.jpg?sqp=-oaymwEbCKgBEF5IVfKriqkDDggBFQAAiEIYAXABwAEG&rs=AOn4CLDKqiGDIbWgYrx5WdmhT6VMNT6n6w	2026-03-29 12:18:43.264857	2
20	7ljAC706eIk	Metallica Death Magnetic Full Album HQ	El Sebitax	https://i.ytimg.com/vi/7ljAC706eIk/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLAHCYpg_zLPluyweT94aylbDyH2fA	2026-03-29 12:18:51.15372	2
21	HdWw9SksiwQ	Fade To Black	Metallica	https://i.ytimg.com/vi/HdWw9SksiwQ/hqdefault.jpg?sqp=-oaymwEbCKgBEF5IVfKriqkDDggBFQAAiEIYAXABwAEG&rs=AOn4CLCmKyD-XkM7RuyISAQtLi_HXE_8Cg	2026-03-29 12:23:37.630647	2
22	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-29 14:03:23.509053	3
23	nXyDagalI3U	Poor Twisted Me	Metallica	https://lh3.googleusercontent.com/K41dWEqd1vu4-Uy0jU44vPjxqEA1QWv7XKHe6sUh9ThLkuNf121grOF9iCJSO-t0T8cEvXS4N1c3ilQO=w544-h544-l90-rj	2026-03-29 14:03:33.904642	3
24	4FKYsUEuvIo	Mama Said	Metallica	https://lh3.googleusercontent.com/K41dWEqd1vu4-Uy0jU44vPjxqEA1QWv7XKHe6sUh9ThLkuNf121grOF9iCJSO-t0T8cEvXS4N1c3ilQO=w544-h544-l90-rj	2026-03-29 14:03:44.527475	3
25	chuCBmiONLg	Thorn Within	Metallica	https://lh3.googleusercontent.com/K41dWEqd1vu4-Uy0jU44vPjxqEA1QWv7XKHe6sUh9ThLkuNf121grOF9iCJSO-t0T8cEvXS4N1c3ilQO=w544-h544-l90-rj	2026-03-29 14:04:20.562931	3
26	1z2w5xJ80cQ	Bleeding Me	Metallica	https://lh3.googleusercontent.com/K41dWEqd1vu4-Uy0jU44vPjxqEA1QWv7XKHe6sUh9ThLkuNf121grOF9iCJSO-t0T8cEvXS4N1c3ilQO=w544-h544-l90-rj	2026-03-29 14:04:43.932933	3
27	4dLNm973lhE	Ain't My Bitch	Metallica	https://lh3.googleusercontent.com/K41dWEqd1vu4-Uy0jU44vPjxqEA1QWv7XKHe6sUh9ThLkuNf121grOF9iCJSO-t0T8cEvXS4N1c3ilQO=w544-h544-l90-rj	2026-03-29 14:04:49.188304	3
28	4dLNm973lhE	Ain't My Bitch	Metallica	https://lh3.googleusercontent.com/K41dWEqd1vu4-Uy0jU44vPjxqEA1QWv7XKHe6sUh9ThLkuNf121grOF9iCJSO-t0T8cEvXS4N1c3ilQO=w544-h544-l90-rj	2026-03-29 14:04:56.016208	3
29	1z2w5xJ80cQ	Bleeding Me	Metallica	https://lh3.googleusercontent.com/K41dWEqd1vu4-Uy0jU44vPjxqEA1QWv7XKHe6sUh9ThLkuNf121grOF9iCJSO-t0T8cEvXS4N1c3ilQO=w544-h544-l90-rj	2026-03-29 14:04:59.751896	3
30	VY0YYXywJ0k	2 x 4	Metallica	https://lh3.googleusercontent.com/K41dWEqd1vu4-Uy0jU44vPjxqEA1QWv7XKHe6sUh9ThLkuNf121grOF9iCJSO-t0T8cEvXS4N1c3ilQO=w544-h544-l90-rj	2026-03-29 14:05:02.283979	3
31	CBJey2dkiAI	Hero of the Day	Metallica	https://lh3.googleusercontent.com/K41dWEqd1vu4-Uy0jU44vPjxqEA1QWv7XKHe6sUh9ThLkuNf121grOF9iCJSO-t0T8cEvXS4N1c3ilQO=w544-h544-l90-rj	2026-03-29 14:06:20.828978	3
32	KwCvQhMQEoM	Satan Is a Lawyer	Gojira	https://lh3.googleusercontent.com/5ILl0buFOqmEM_fDIxnKfK6GbOjh8AQjPX6nlOvxbnLX-XI7YYTHNDz6S5IIy7f7YZq0E-aQ1iXLEpFn=w544-h544-l90-rj	2026-03-29 14:06:56.500557	3
33	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-29 14:07:46.275282	3
34	FLTchCiC0T0	Seek & Destroy	Metallica	https://lh3.googleusercontent.com/dA67nWR2eOVRS6zGlM6BjRKYFlGHj1Yc-M9Ep5MD53bLc7_4POp4vDqULJdfKtu2RKhSRrP5g8JCiQA=w544-h544-l90-rj	2026-03-29 14:10:07.799601	3
35	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-30 06:46:46.869191	3
36	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-30 07:44:19.944739	3
37	1z2w5xJ80cQ	Bleeding Me	Metallica	https://lh3.googleusercontent.com/K41dWEqd1vu4-Uy0jU44vPjxqEA1QWv7XKHe6sUh9ThLkuNf121grOF9iCJSO-t0T8cEvXS4N1c3ilQO=w544-h544-l90-rj	2026-03-30 07:45:21.341103	3
38	1z2w5xJ80cQ	Bleeding Me	Metallica	https://lh3.googleusercontent.com/K41dWEqd1vu4-Uy0jU44vPjxqEA1QWv7XKHe6sUh9ThLkuNf121grOF9iCJSO-t0T8cEvXS4N1c3ilQO=w544-h544-l90-rj	2026-03-30 07:45:46.626492	3
39	fmgkrhA_ObI	Cure	Metallica	https://lh3.googleusercontent.com/K41dWEqd1vu4-Uy0jU44vPjxqEA1QWv7XKHe6sUh9ThLkuNf121grOF9iCJSO-t0T8cEvXS4N1c3ilQO=w544-h544-l90-rj	2026-03-30 07:45:51.624765	3
40	fmgkrhA_ObI	Cure	Metallica	https://lh3.googleusercontent.com/K41dWEqd1vu4-Uy0jU44vPjxqEA1QWv7XKHe6sUh9ThLkuNf121grOF9iCJSO-t0T8cEvXS4N1c3ilQO=w544-h544-l90-rj	2026-03-30 07:45:54.340523	3
41	VY0YYXywJ0k	2 x 4	Metallica	https://lh3.googleusercontent.com/K41dWEqd1vu4-Uy0jU44vPjxqEA1QWv7XKHe6sUh9ThLkuNf121grOF9iCJSO-t0T8cEvXS4N1c3ilQO=w544-h544-l90-rj	2026-03-30 07:46:46.084992	3
42	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-30 07:47:00.508015	3
43	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-03-30 07:52:50.541649	3
44	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-30 17:49:25.653056	3
45	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-30 17:49:28.194134	3
46	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-03-30 17:49:36.620276	3
47	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-30 17:49:38.106772	3
48	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-03-30 17:49:38.44384	3
49	vA1nlwTbCvg	Battery	Metallica	https://yt3.googleusercontent.com/YArfdE0OKeDbWBrrps0MPrrVEzkMwu-SmUiDQV7VbfaS1eSqhA29i_IkD3RnTuG_g9MrlQQBbjCugZN0=w544-h544-l90-rj	2026-03-30 17:50:02.616121	3
50	6xjJ2XIbGRk	Master of Puppets	Metallica	https://yt3.googleusercontent.com/YArfdE0OKeDbWBrrps0MPrrVEzkMwu-SmUiDQV7VbfaS1eSqhA29i_IkD3RnTuG_g9MrlQQBbjCugZN0=w544-h544-l90-rj	2026-03-30 17:50:08.720521	3
51	vA1nlwTbCvg	Battery	Metallica	https://yt3.googleusercontent.com/YArfdE0OKeDbWBrrps0MPrrVEzkMwu-SmUiDQV7VbfaS1eSqhA29i_IkD3RnTuG_g9MrlQQBbjCugZN0=w544-h544-l90-rj	2026-03-30 17:50:15.134917	3
52	6xjJ2XIbGRk	Master of Puppets	Metallica	https://yt3.googleusercontent.com/YArfdE0OKeDbWBrrps0MPrrVEzkMwu-SmUiDQV7VbfaS1eSqhA29i_IkD3RnTuG_g9MrlQQBbjCugZN0=w544-h544-l90-rj	2026-03-30 17:50:21.904593	3
53	CD-E-LDc384	Enter Sandman	Metallica	https://lh3.googleusercontent.com/2SJUS7YtuaGIBU8-0lFxMi_T6Ned9JjM3GvZJr3JJIPNQxwXSa8hIbSOSxl1tRaPHnrLDVfJBJBvuqg=w544-h544-l90-rj	2026-03-30 17:51:41.304094	3
54	A8MO7fkZc5o	Sad But True	Metallica	https://lh3.googleusercontent.com/2SJUS7YtuaGIBU8-0lFxMi_T6Ned9JjM3GvZJr3JJIPNQxwXSa8hIbSOSxl1tRaPHnrLDVfJBJBvuqg=w544-h544-l90-rj	2026-03-30 17:51:49.970627	3
55	B_HSa1dEL9s	For Whom The Bell Tolls (Remastered)	Metallica	https://i.ytimg.com/vi/B_HSa1dEL9s/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCH_Zm-jMudQwse7HgA9iD2K3ruBQ	2026-03-30 17:54:44.310784	3
56	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-03-30 17:54:48.9963	3
57	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-30 17:54:49.361527	3
58	B_HSa1dEL9s	For Whom The Bell Tolls (Remastered)	Metallica	https://i.ytimg.com/vi/B_HSa1dEL9s/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCH_Zm-jMudQwse7HgA9iD2K3ruBQ	2026-03-30 17:54:50.757079	3
59	A8MO7fkZc5o	Metallica: Sad But True (Official Music Video)	Metallica	https://i.ytimg.com/vi/A8MO7fkZc5o/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCU2QvnQDqbbEgzjlU5emp58CInzw	2026-03-30 17:55:00.024588	3
60	qPOTEs_yTJo	Metallica: Turn the Page (Official Music Video)	Metallica	https://i.ytimg.com/vi/qPOTEs_yTJo/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDYzzdMXviUEbZXzQC5jnX16EFjbg	2026-03-30 17:56:05.088544	3
61	9HZ_tx8aWuA	Fade To Black (Remastered)	Metallica	https://i.ytimg.com/vi/9HZ_tx8aWuA/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLChJWqf2IT4-F9k7wEfz3EuUYJYdQ	2026-03-30 17:56:08.358894	3
62	A8MO7fkZc5o	Metallica: Sad But True (Official Music Video)	Metallica	https://i.ytimg.com/vi/A8MO7fkZc5o/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCU2QvnQDqbbEgzjlU5emp58CInzw	2026-03-30 17:56:08.969446	3
63	boanuwUMNNQ	Metallica: Whiskey in the Jar (Official Music Video)	Metallica	https://i.ytimg.com/vi/boanuwUMNNQ/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCy-JYf-vfw0TfNSRU3w98nVsGmkw	2026-03-30 17:56:09.940061	3
64	87by1DjfxLw	Metallica - Enter Sandman (Live in Mexico City) [Orgullo, Pasión, y Gloria]	Metallica	https://i.ytimg.com/vi/87by1DjfxLw/hq720.jpg?sqp=-oaymwE2COgCEMoBSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB_gmAAtAFigIMCAAQARhiIEwoZTAP&rs=AOn4CLBEzoZqdos5xFR53b9XleRRrjj1ZA	2026-03-30 17:56:16.290942	3
65	E0ozmU9cJDg	Master of Puppets (Remastered)	Metallica	https://i.ytimg.com/vi/E0ozmU9cJDg/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLA1h5moIv8OSGNR1obZiAMqcUesmg	2026-03-30 17:56:31.408595	3
223	ZZilvuzCwjk	4th Arra of Dagon	Nile	https://i.ytimg.com/vi/ZZilvuzCwjk/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-05 20:06:28.909442	2
66	boanuwUMNNQ	Metallica: Whiskey in the Jar (Official Music Video)	Metallica	https://i.ytimg.com/vi/boanuwUMNNQ/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCy-JYf-vfw0TfNSRU3w98nVsGmkw	2026-03-30 17:56:57.804572	3
67	B_HSa1dEL9s	For Whom The Bell Tolls (Remastered)	Metallica	https://i.ytimg.com/vi/B_HSa1dEL9s/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCH_Zm-jMudQwse7HgA9iD2K3ruBQ	2026-03-30 17:56:59.621459	3
68	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-03-30 18:01:58.22147	3
69	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-03-30 18:05:55.644032	3
70	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-03-30 18:05:58.337039	3
71	iVvXB-Vwnco	Gojira - Silvera [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/iVvXB-Vwnco/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDNztskmDWnzlTHA4UwTj54Jfo5Lg	2026-03-30 18:06:03.04477	3
72	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-31 15:42:38.122704	3
73	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-31 15:42:40.763332	3
74	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-31 15:42:42.084612	3
75	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-03-31 15:42:43.94551	3
76	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-31 15:42:45.16296	3
77	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-03-31 15:42:46.953958	3
78	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-31 15:42:48.785724	3
79	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-31 15:42:57.314252	3
80	9HZ_tx8aWuA	Fade To Black (Remastered)	Metallica	https://i.ytimg.com/vi/9HZ_tx8aWuA/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLChJWqf2IT4-F9k7wEfz3EuUYJYdQ	2026-03-31 15:43:00.061588	3
81	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-03-31 15:43:09.828706	3
82	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-03-31 15:43:10.618898	3
83	WM8bTdBs-cw	Metallica: One (Official Music Video)	Metallica	https://i.ytimg.com/vi/WM8bTdBs-cw/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDG3XhH7F1veJoQbA_PTuMcGP7V1w	2026-03-31 15:43:14.899908	3
84	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-03-31 15:43:32.980961	3
85	CD-E-LDc384	Enter Sandman	Metallica	https://yt3.googleusercontent.com/2SJUS7YtuaGIBU8-0lFxMi_T6Ned9JjM3GvZJr3JJIPNQxwXSa8hIbSOSxl1tRaPHnrLDVfJBJBvuqg=w544-h544-l90-rj	2026-03-31 15:43:40.258305	3
86	WM8bTdBs-cw	Metallica: One (Official Music Video)	Metallica	https://i.ytimg.com/vi/WM8bTdBs-cw/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDG3XhH7F1veJoQbA_PTuMcGP7V1w	2026-03-31 15:43:46.279722	3
87	9HZ_tx8aWuA	Fade To Black (Remastered)	Metallica	https://i.ytimg.com/vi/9HZ_tx8aWuA/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLChJWqf2IT4-F9k7wEfz3EuUYJYdQ	2026-03-31 15:50:16.008504	3
88	maqMIO6GUOk	Holier Than Thou	Metallica	https://yt3.googleusercontent.com/2SJUS7YtuaGIBU8-0lFxMi_T6Ned9JjM3GvZJr3JJIPNQxwXSa8hIbSOSxl1tRaPHnrLDVfJBJBvuqg=w544-h544-l90-rj	2026-03-31 15:52:56.984828	3
89	CD-E-LDc384	Enter Sandman	Metallica	https://yt3.googleusercontent.com/2SJUS7YtuaGIBU8-0lFxMi_T6Ned9JjM3GvZJr3JJIPNQxwXSa8hIbSOSxl1tRaPHnrLDVfJBJBvuqg=w544-h544-l90-rj	2026-03-31 15:53:01.529957	3
90	9HZ_tx8aWuA	Fade To Black (Remastered)	Metallica	https://i.ytimg.com/vi/9HZ_tx8aWuA/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLChJWqf2IT4-F9k7wEfz3EuUYJYdQ	2026-03-31 15:53:12.418097	3
91	WM8bTdBs-cw	Metallica: One (Official Music Video)	Metallica	https://i.ytimg.com/vi/WM8bTdBs-cw/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDG3XhH7F1veJoQbA_PTuMcGP7V1w	2026-03-31 16:00:46.850457	3
92	WM8bTdBs-cw	One	Metallica	https://yt3.googleusercontent.com/frB4U1GqdC4akydEuAZBOVW3anSFC9uolGzFy9G_a40AmW1j_dZV_B5tdbhAxcknPstLiRKtkH3d5bc=w544-h544-l90-rj	2026-03-31 16:01:13.625227	3
93	6xjJ2XIbGRk	Master of Puppets	Metallica	https://yt3.googleusercontent.com/YArfdE0OKeDbWBrrps0MPrrVEzkMwu-SmUiDQV7VbfaS1eSqhA29i_IkD3RnTuG_g9MrlQQBbjCugZN0=w544-h544-l90-rj	2026-04-03 10:46:24.892328	3
94	6xjJ2XIbGRk	Master of Puppets	Metallica	https://yt3.googleusercontent.com/YArfdE0OKeDbWBrrps0MPrrVEzkMwu-SmUiDQV7VbfaS1eSqhA29i_IkD3RnTuG_g9MrlQQBbjCugZN0=w544-h544-l90-rj	2026-04-03 10:46:28.010544	3
95	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-04-03 10:47:46.880958	3
96	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-04-03 10:48:01.866607	3
97	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-04-03 10:48:03.093825	3
98	WM8bTdBs-cw	Metallica: One (Official Music Video)	Metallica	https://i.ytimg.com/vi/WM8bTdBs-cw/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDG3XhH7F1veJoQbA_PTuMcGP7V1w	2026-04-03 10:48:11.901409	3
99	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-04-03 10:48:39.810576	3
100	6xjJ2XIbGRk	Master of Puppets	Metallica	https://yt3.googleusercontent.com/YArfdE0OKeDbWBrrps0MPrrVEzkMwu-SmUiDQV7VbfaS1eSqhA29i_IkD3RnTuG_g9MrlQQBbjCugZN0=w544-h544-l90-rj	2026-04-03 10:55:21.865279	3
101	6xjJ2XIbGRk	Master of Puppets	Metallica	https://yt3.googleusercontent.com/YArfdE0OKeDbWBrrps0MPrrVEzkMwu-SmUiDQV7VbfaS1eSqhA29i_IkD3RnTuG_g9MrlQQBbjCugZN0=w544-h544-l90-rj	2026-04-03 10:56:01.372809	3
102	6xjJ2XIbGRk	Master of Puppets	Metallica	https://yt3.googleusercontent.com/YArfdE0OKeDbWBrrps0MPrrVEzkMwu-SmUiDQV7VbfaS1eSqhA29i_IkD3RnTuG_g9MrlQQBbjCugZN0=w544-h544-l90-rj	2026-04-03 10:56:19.153716	3
103	B_HSa1dEL9s	For Whom The Bell Tolls (Remastered)	Metallica	https://i.ytimg.com/vi/B_HSa1dEL9s/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCH_Zm-jMudQwse7HgA9iD2K3ruBQ	2026-04-03 10:56:32.265494	3
104	B_HSa1dEL9s	For Whom The Bell Tolls (Remastered)	Metallica	https://i.ytimg.com/vi/B_HSa1dEL9s/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCH_Zm-jMudQwse7HgA9iD2K3ruBQ	2026-04-03 10:56:46.772625	3
105	6xjJ2XIbGRk	Master of Puppets	Metallica	https://yt3.googleusercontent.com/YArfdE0OKeDbWBrrps0MPrrVEzkMwu-SmUiDQV7VbfaS1eSqhA29i_IkD3RnTuG_g9MrlQQBbjCugZN0=w544-h544-l90-rj	2026-04-03 10:56:58.671323	3
106	6xjJ2XIbGRk	Master of Puppets	Metallica	https://yt3.googleusercontent.com/YArfdE0OKeDbWBrrps0MPrrVEzkMwu-SmUiDQV7VbfaS1eSqhA29i_IkD3RnTuG_g9MrlQQBbjCugZN0=w544-h544-l90-rj	2026-04-03 10:57:41.142659	3
107	vA1nlwTbCvg	Battery	Metallica	https://yt3.googleusercontent.com/YArfdE0OKeDbWBrrps0MPrrVEzkMwu-SmUiDQV7VbfaS1eSqhA29i_IkD3RnTuG_g9MrlQQBbjCugZN0=w544-h544-l90-rj	2026-04-03 11:05:11.906164	3
108	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-04-26 09:02:34.924142	2
109	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-04-26 09:03:48.913589	2
110	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-04-26 09:03:51.154584	2
111	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-04-26 10:14:31.415561	2
112	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-04-26 21:05:38.109231	2
113	B_HSa1dEL9s	For Whom The Bell Tolls (Remastered)	Metallica	https://i.ytimg.com/vi/B_HSa1dEL9s/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCH_Zm-jMudQwse7HgA9iD2K3ruBQ	2026-04-26 21:05:41.970356	2
114	B_HSa1dEL9s	For Whom The Bell Tolls (Remastered)	Metallica	https://i.ytimg.com/vi/B_HSa1dEL9s/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCH_Zm-jMudQwse7HgA9iD2K3ruBQ	2026-04-26 21:05:43.234283	2
115	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-04-26 21:18:32.085554	2
116	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-04-26 21:29:05.173476	2
117	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-04-26 21:29:20.780911	2
118	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-04-26 21:33:42.517716	2
119	tAGnKpE4NCI	Metallica: Nothing Else Matters (Official Music Video)	Metallica	https://i.ytimg.com/vi/tAGnKpE4NCI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCbU2DzhY8TCH0mEg6g-mV29MqF2Q	2026-04-27 18:22:54.137176	2
120	WM8bTdBs-cw	Metallica: One (Official Music Video)	Metallica	https://i.ytimg.com/vi/WM8bTdBs-cw/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDG3XhH7F1veJoQbA_PTuMcGP7V1w	2026-04-27 19:21:22.692492	2
121	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-04-28 13:48:09.205375	2
122	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-04-28 14:24:53.800704	2
123	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:10:36.941063	2
124	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:18:52.273351	2
125	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 10:18:58.291011	2
126	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:19:02.374555	2
127	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:19:06.831126	2
128	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 10:19:07.941581	2
129	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:19:09.597967	2
130	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:19:11.634024	2
131	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:19:22.095455	2
132	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 10:19:28.292055	2
133	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:19:30.759818	2
134	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 10:19:33.022962	2
135	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:19:35.756416	2
136	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 10:19:36.363866	2
137	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:19:37.37409	2
138	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:19:37.872032	2
139	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 10:19:38.587453	2
140	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:19:40.091614	2
141	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:19:40.686775	2
142	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:19:41.200772	2
143	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:19:41.676789	2
144	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 10:19:42.107702	2
145	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:19:42.814645	2
146	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:19:43.170519	2
147	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:19:44.303315	2
148	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:19:44.739856	2
149	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:19:45.22921	2
150	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:19:45.798774	2
151	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 10:19:46.107726	2
152	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:19:46.666036	2
153	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 10:19:54.032115	2
154	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:20:08.077774	2
155	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:20:09.735309	2
156	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:30:04.825365	2
157	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:30:07.41401	2
158	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:30:13.213769	2
159	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 10:30:19.431884	2
452	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-08 14:49:18.142477	2
160	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:30:35.639989	2
161	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:30:40.632012	2
162	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:30:44.581319	2
163	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 10:30:45.689378	2
164	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:30:52.876226	2
165	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:30:55.681638	2
166	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:30:56.821345	2
167	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:30:58.496523	2
168	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:30:59.756994	2
169	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 10:31:02.078769	2
170	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:43:34.524805	2
171	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 10:44:06.679893	2
172	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:44:09.433484	2
173	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 10:46:22.311235	2
174	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:49:39.307551	2
175	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 10:51:41.319935	2
176	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 11:11:08.018621	2
177	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 11:11:19.739896	2
178	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 11:12:48.104289	2
179	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 11:13:29.749476	2
180	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 11:13:48.406041	2
181	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 17:09:17.909158	2
182	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 17:09:27.142832	2
183	TmF6oFbglBY	Lashed To the Slave Stick	Nile	https://i.ytimg.com/vi/TmF6oFbglBY/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-04 17:10:28.264658	2
184	Vh5vjre7d0w	Nile – "Lashed To The Slave Stick" live, Rock Hard Festival l 2025 | Rockpalast	WDR Rockpalast	https://i.ytimg.com/vi/Vh5vjre7d0w/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBuwAyyvpHW8R-NK6m5Sn4K2f91zA	2026-05-04 17:12:00.151131	2
185	0GAKshbyC1w	Nile - Lashed To The Slave Stick live 27 August 2007 at Jaxx in Springfield, Virginia	DCHeavyMetal.com	https://i.ytimg.com/vi/0GAKshbyC1w/hqdefault.jpg?sqp=-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgBzgaAAuADigIMCAAQARh_IBMoGjAP&rs=AOn4CLDra-WsRMVCy30Uv2Ga98RuqHX11w	2026-05-04 17:12:35.686255	2
186	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 17:13:11.569675	2
187	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 17:13:16.643995	2
188	TmF6oFbglBY	Lashed To the Slave Stick	Nile	https://i.ytimg.com/vi/TmF6oFbglBY/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-04 17:13:19.613359	2
189	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 17:13:25.371795	2
190	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 17:13:29.06096	2
191	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 17:13:33.166175	2
192	TmF6oFbglBY	Lashed To the Slave Stick	Nile	https://i.ytimg.com/vi/TmF6oFbglBY/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-04 17:28:14.700492	2
193	TmF6oFbglBY	Lashed To the Slave Stick	Nile	https://i.ytimg.com/vi/TmF6oFbglBY/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-04 17:28:22.641934	2
194	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 17:28:35.738725	2
195	TmF6oFbglBY	Lashed To the Slave Stick	Nile	https://i.ytimg.com/vi/TmF6oFbglBY/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-04 17:28:41.026785	2
196	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 17:28:44.569157	2
197	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-04 17:28:55.801773	2
198	TmF6oFbglBY	Lashed To the Slave Stick	Nile	https://i.ytimg.com/vi/TmF6oFbglBY/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-04 17:28:56.72869	2
199	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-04 17:29:02.281535	2
200	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-04 17:29:04.72836	2
201	wpsQQgLUf5E	NILE - Maximum Metal DVD - Vol. 126 (OFFICIAL)	Nile	https://i.ytimg.com/vi/wpsQQgLUf5E/hqdefault.jpg?sqp=-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgBvgKAAvABigIMCAAQARhlIGAoTTAP&rs=AOn4CLCPlQxYJ2SBpOWaTGuNPApLqNTUVA	2026-05-04 17:29:18.595136	2
202	Y0HfmYBlF8g	Making aerogel	NileRed	https://i.ytimg.com/vi/Y0HfmYBlF8g/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCOcF1sSmUarFPDfaEPEfDZQPForw	2026-05-04 17:29:25.940832	2
203	7zKxHeyIO5s	To Dream of Ur	Nile	https://i.ytimg.com/vi/7zKxHeyIO5s/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC-IQOs8EqPaK964w1A0vSmFAdVww	2026-05-04 17:29:35.311513	2
204	2nAOMjVi-AE	What Can Be Safely Written	Nile	https://i.ytimg.com/vi/2nAOMjVi-AE/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCW3chJqQVZzMe7Hia4CPUIE95f_Q	2026-05-04 17:32:57.407216	2
205	2nAOMjVi-AE	What Can Be Safely Written	Nile	https://i.ytimg.com/vi/2nAOMjVi-AE/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCW3chJqQVZzMe7Hia4CPUIE95f_Q	2026-05-04 17:33:01.428675	2
206	ZZilvuzCwjk	4th Arra of Dagon	Nile	https://i.ytimg.com/vi/ZZilvuzCwjk/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-04 17:33:02.643284	2
207	ZZilvuzCwjk	4th Arra of Dagon	Nile	https://i.ytimg.com/vi/ZZilvuzCwjk/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-04 17:33:11.984029	2
208	ZZilvuzCwjk	4th Arra of Dagon	Nile	https://i.ytimg.com/vi/ZZilvuzCwjk/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-04 17:33:50.00476	2
209	ZZilvuzCwjk	4th Arra of Dagon	Nile	https://i.ytimg.com/vi/ZZilvuzCwjk/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-04 17:33:54.595035	2
210	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-05 11:11:35.150493	2
211	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-05 11:13:33.999341	2
212	LBKuHpJprVI	МАКСИМ ФАДЕЕВ – ВДВОЁМ	МАКСИМ ФАДЕЕВ	https://i.ytimg.com/vi/LBKuHpJprVI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLAXTXoznXwJvS2yOka4IHQl-EJezQ	2026-05-05 11:13:45.893338	2
213	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	https://i.ytimg.com/vi/CD-E-LDc384/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-05 13:13:38.953153	2
214	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-05 13:35:50.541075	2
215	0GAKshbyC1w	Nile - Lashed To The Slave Stick live 27 August 2007 at Jaxx in Springfield, Virginia	DCHeavyMetal.com	https://i.ytimg.com/vi/0GAKshbyC1w/hqdefault.jpg?sqp=-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgBzgaAAuADigIMCAAQARh_IBMoGjAP&rs=AOn4CLDra-WsRMVCy30Uv2Ga98RuqHX11w	2026-05-05 13:38:41.543265	2
216	ZZilvuzCwjk	4th Arra of Dagon	Nile	https://i.ytimg.com/vi/ZZilvuzCwjk/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-05 13:38:42.506111	2
217	kKq_6mp7SfM	Metallica - Beyond Magnetic [ FULL ALBUM ]	Metallica Music	https://i.ytimg.com/vi/kKq_6mp7SfM/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBCgM7me1qWVgxLezohIToWkj6s_w	2026-05-05 13:38:43.287665	2
218	ZZilvuzCwjk	4th Arra of Dagon	Nile	https://i.ytimg.com/vi/ZZilvuzCwjk/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-05 13:38:44.031742	2
219	TmF6oFbglBY	Lashed To the Slave Stick	Nile	https://i.ytimg.com/vi/TmF6oFbglBY/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-05 13:49:21.460971	2
220	ZZilvuzCwjk	4th Arra of Dagon	Nile	https://i.ytimg.com/vi/ZZilvuzCwjk/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-05 13:49:28.724738	2
221	TmF6oFbglBY	Lashed To the Slave Stick	Nile	https://i.ytimg.com/vi/TmF6oFbglBY/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-05 16:06:32.130188	2
222	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-05 20:06:00.946653	2
224	64fFba1X9UM	Those Whom the Gods Detest	Nile	\N	2026-05-05 20:35:05.104915	2
225	0YbCpdd0Iek	Slavic Metal Music - Beast Within	Filip Lackovic	https://i.ytimg.com/vi/0YbCpdd0Iek/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLAOpZOttuNaydlGHoOj6UskjoXq6A	2026-05-06 18:06:57.217223	2
226	DQPID4nVwqU	Slit Your Guts	Cryptopsy	\N	2026-05-06 18:08:29.178385	2
227	YARem0SvqpU	Graves of the Fathers	Cryptopsy	\N	2026-05-06 19:40:10.34895	2
228	YARem0SvqpU	Graves of the Fathers	Cryptopsy	\N	2026-05-06 19:40:13.316182	2
229	YARem0SvqpU	Graves of the Fathers	Cryptopsy	\N	2026-05-06 19:40:14.365697	2
230	YARem0SvqpU	Graves of the Fathers	Cryptopsy	\N	2026-05-06 19:40:15.390739	2
231	YARem0SvqpU	Graves of the Fathers	Cryptopsy	\N	2026-05-06 19:40:24.384546	2
232	YARem0SvqpU	Graves of the Fathers	Cryptopsy	\N	2026-05-06 19:47:26.212041	2
233	YARem0SvqpU	Graves of the Fathers	Cryptopsy	\N	2026-05-06 20:12:30.537002	2
234	0YbCpdd0Iek	Slavic Metal Music - Beast Within	Filip Lackovic	https://i.ytimg.com/vi/0YbCpdd0Iek/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLAOpZOttuNaydlGHoOj6UskjoXq6A	2026-05-06 20:12:39.82212	2
235	ZZilvuzCwjk	4th Arra of Dagon	Nile	https://i.ytimg.com/vi/ZZilvuzCwjk/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-06 20:12:46.38925	2
236	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-06 20:12:56.357273	2
237	TmF6oFbglBY	Lashed To the Slave Stick	Nile	https://i.ytimg.com/vi/TmF6oFbglBY/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-06 20:13:21.155126	2
238	zjxCZEiSaNQ	Crown of Horns	Cryptopsy	https://i.ytimg.com/vi/zjxCZEiSaNQ/maxresdefault.jpg	2026-05-06 20:19:29.368798	2
239	zjxCZEiSaNQ	Crown of Horns	Cryptopsy	https://i.ytimg.com/vi/zjxCZEiSaNQ/maxresdefault.jpg	2026-05-06 20:32:21.12583	2
240	ocJWc7DgGp8	Indie/Rock/Alternative Compilation - May 2025 (2-Hour Playlist)	alexrainbirdMusic	https://i.ytimg.com/vi/ocJWc7DgGp8/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDtzqGX2hYbqiyTsTcAhjqfSXVaVQ	2026-05-06 20:32:42.373073	2
241	ocJWc7DgGp8	Indie/Rock/Alternative Compilation - May 2025 (2-Hour Playlist)	alexrainbirdMusic	https://i.ytimg.com/vi/ocJWc7DgGp8/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDtzqGX2hYbqiyTsTcAhjqfSXVaVQ	2026-05-06 20:32:49.364217	2
242	ocJWc7DgGp8	Indie/Rock/Alternative Compilation - May 2025 (2-Hour Playlist)	alexrainbirdMusic	https://i.ytimg.com/vi/ocJWc7DgGp8/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDtzqGX2hYbqiyTsTcAhjqfSXVaVQ	2026-05-06 20:37:24.40978	2
243	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FCD-E-LDc384%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-06 20:45:17.092597	2
244	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FQ8WJz-DmPVg%2Fhqdefault.jpg%3Fsqp%3D-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-06 20:45:31.579557	2
245	vWOz5iQpgUA	#OnThisDay in 1997, our video for 'King Nothing,' directed by Matt Mahurin, debuted...	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FvWOz5iQpgUA%2Fhqdefault.jpg	2026-05-06 20:51:13.893483	2
246	v2AC41dglnM	Thunderstruck	AC/DC	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2Fv2AC41dglnM%2Fhqdefault.jpg	2026-05-06 20:53:56.823101	2
247	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-06 20:55:54.949794	2
248	QXvqw4opL6U	In Abeyance	Cryptopsy	/api/images/proxy?u=https%3A%2F%2Fyt3.googleusercontent.com%2F7PUfc6qE3TnxxJZwqkA_J18XIFT5HLJvM2XlB2TCnebw7sUBlCTCjSMS9BQnyf2IQz7YqWPLweVCvP5p%3Dw544-h544-l90-rj	2026-05-06 20:56:11.317394	2
249	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-06 21:06:04.060541	2
250	TmF6oFbglBY	Lashed To the Slave Stick	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTmF6oFbglBY%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-06 21:06:34.873378	2
251	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-06 21:06:41.678505	2
252	TmF6oFbglBY	Lashed To the Slave Stick	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTmF6oFbglBY%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-06 21:06:45.607669	2
253	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-06 21:06:52.256022	2
254	3p85-KtgDSs	Born For One Thing	Gojira	/api/images/proxy?u=https%3A%2F%2Fyt3.googleusercontent.com%2F98M484vsTOCcJWGrNYt-hGFjj4dRbxu3iYQ0b-yS6QKrQPKLk3RXMOyKxnSPDeB6i3BxqbHwlNsALis%3Dw544-h544-l90-rj	2026-05-06 21:07:46.19372	2
255	ZZilvuzCwjk	4th Arra of Dagon	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FZZilvuzCwjk%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-06 21:11:57.776984	2
256	ZZilvuzCwjk	4th Arra of Dagon	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FZZilvuzCwjk%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-06 21:12:01.271591	2
257	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-06 21:12:08.858304	2
258	TmF6oFbglBY	Lashed To the Slave Stick	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTmF6oFbglBY%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-06 21:12:11.761251	2
259	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-06 21:12:14.634686	2
260	TmF6oFbglBY	Lashed To the Slave Stick	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTmF6oFbglBY%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-06 21:12:15.045109	2
261	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-06 21:12:15.397752	2
262	wtUQ8JJ9KKs	The Prince	Metallica	/api/images/proxy?u=https%3A%2F%2Fyt3.googleusercontent.com%2FvCwdAeNhB0HRSg0vzY3RwSAQwzmaiU_dA7xQ1Fq-31ffXF3FKbVMpgeFy8Ws5KqjSBADbUEDx4vNpLjL%3Dw544-h544-l90-rj	2026-05-06 21:12:59.544135	2
263	wtUQ8JJ9KKs	The Prince	Metallica	/api/images/proxy?u=https%3A%2F%2Fyt3.googleusercontent.com%2FvCwdAeNhB0HRSg0vzY3RwSAQwzmaiU_dA7xQ1Fq-31ffXF3FKbVMpgeFy8Ws5KqjSBADbUEDx4vNpLjL%3Dw544-h544-l90-rj	2026-05-06 21:19:17.092193	2
264	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-06 21:35:37.326381	2
265	v2AC41dglnM	AC/DC - Thunderstruck (Official Video)	AC/DC	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2Fv2AC41dglnM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLB3h9kpQx4cInRC0ds_cSXp2GvoTg	2026-05-07 10:20:38.529305	2
266	ZZilvuzCwjk	4th Arra of Dagon	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FZZilvuzCwjk%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-07 10:22:47.377777	2
267	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-07 10:22:49.667507	2
268	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FQ8WJz-DmPVg%2Fhqdefault.jpg%3Fsqp%3D-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-07 10:22:50.215591	2
269	ZZilvuzCwjk	4th Arra of Dagon	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FZZilvuzCwjk%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-07 10:22:50.874485	2
270	ZZilvuzCwjk	4th Arra of Dagon	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FZZilvuzCwjk%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-07 10:51:39.468392	2
271	ZZilvuzCwjk	4th Arra of Dagon	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FZZilvuzCwjk%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-07 10:51:56.203468	2
272	ZZilvuzCwjk	4th Arra of Dagon	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FZZilvuzCwjk%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-07 10:52:11.440947	2
273	TmF6oFbglBY	Lashed To the Slave Stick	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTmF6oFbglBY%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-07 10:52:12.773913	2
274	ZZilvuzCwjk	4th Arra of Dagon	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FZZilvuzCwjk%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-07 10:52:13.816588	2
275	ZZilvuzCwjk	4th Arra of Dagon	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FZZilvuzCwjk%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-07 10:52:20.015699	2
276	CD-E-LDc384	Metallica: Enter Sandman (Official Music Video)	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FCD-E-LDc384%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLC2DnT6jTuHbMwWi_FyT7Yyw07s8g	2026-05-07 10:52:22.05912	2
277	TmF6oFbglBY	Lashed To the Slave Stick	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTmF6oFbglBY%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-07 10:52:30.778227	2
278	ZZilvuzCwjk	4th Arra of Dagon	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FZZilvuzCwjk%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-07 10:52:52.922178	2
279	ZZilvuzCwjk	4th Arra of Dagon	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FZZilvuzCwjk%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLB348EN9ILShb6ws_7nzZKFC_WELg	2026-05-07 10:53:05.655975	2
280	v2AC41dglnM	AC/DC - Thunderstruck (Official Video)	AC/DC	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2Fv2AC41dglnM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLB3h9kpQx4cInRC0ds_cSXp2GvoTg	2026-05-07 10:53:13.313081	2
281	Lo2qQmj0_h4	AC/DC - You Shook Me All Night Long (Official 4K Video)	AC/DC	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FLo2qQmj0_h4%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDOWaqkyFc3F9lvdiSREJXRGSBm4w	2026-05-07 10:53:39.386648	2
282	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-07 10:54:54.406066	2
283	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FQ8WJz-DmPVg%2Fhqdefault.jpg%3Fsqp%3D-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-07 10:54:59.87477	2
284	TmF6oFbglBY	Lashed To the Slave Stick	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTmF6oFbglBY%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-07 10:55:03.754396	2
285	TmF6oFbglBY	Lashed To the Slave Stick	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTmF6oFbglBY%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-07 10:56:34.427615	2
286	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-07 10:56:38.067832	2
287	nZxCHcXotZ0	Immolation of the Heavens	HOYO-MiX	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FnZxCHcXotZ0%2Fhqdefault.jpg	2026-05-07 10:57:14.967905	2
288	HtEWiY7uK8A	Epic Nordic Viking Music I Frozen Tides I Fitness Motivation	Skaldir - Viking Music	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FHtEWiY7uK8A%2Fhqdefault.jpg	2026-05-07 10:57:27.311595	2
289	dTifD2Z3Drs	Rammstein - Sonne | EPIC Trailer Version	WEllFSILVA	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FdTifD2Z3Drs%2Fhqdefault.jpg	2026-05-07 10:57:46.793783	2
290	dTifD2Z3Drs	Rammstein - Sonne | EPIC Trailer Version	WEllFSILVA	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FdTifD2Z3Drs%2Fhqdefault.jpg	2026-05-07 10:58:10.080698	2
291	TmF6oFbglBY	Lashed To the Slave Stick	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTmF6oFbglBY%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-07 11:05:47.53932	2
292	TmF6oFbglBY	Lashed To the Slave Stick	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTmF6oFbglBY%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-07 11:05:57.675527	2
293	YsZHqi1yBvQ	Cast Down the Heretic	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FYsZHqi1yBvQ%2Fhqdefault.jpg	2026-05-07 13:13:48.473535	2
294	TmF6oFbglBY	Lashed To the Slave Stick	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTmF6oFbglBY%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-07 13:14:53.188851	2
295	Hc_td_w7dvc	The Shadow Of The Abattoir	Trivium	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FHc_td_w7dvc%2Fhqdefault.jpg	2026-05-07 13:51:30.234338	2
296	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-07 13:51:45.547729	2
297	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-07 13:54:33.777815	2
298	TmF6oFbglBY	Lashed To the Slave Stick	Nile	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTmF6oFbglBY%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCle-CUqQ17X9LC028aODpYHZLyLw	2026-05-07 14:34:49.028413	2
299	3mbvWn1EY6g	Ace of Spades	Motörhead	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2F3mbvWn1EY6g%2Fhqdefault.jpg	2026-05-07 16:05:36.348975	2
300	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-07 16:06:12.25312	2
301	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-07 16:24:07.353588	2
302	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-07 16:25:41.437232	2
303	clip:fb7bb28326a5	Silvera	Gojira	/clip-cover.svg	2026-05-07 16:26:03.794496	2
304	TnRZhLRv6eM	Angel Of Death	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTnRZhLRv6eM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLD4ZUSb6onPylwc1Yw2QwXRSfFv6A	2026-05-07 16:26:10.956605	2
305	clip:93cbdd02ec52	testyy	Slayer	/clip-cover.svg	2026-05-07 16:26:37.544142	2
306	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-07 16:28:06.063883	2
307	3mbvWn1EY6g	Ace of Spades	Motörhead	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2F3mbvWn1EY6g%2Fhqdefault.jpg	2026-05-07 16:29:06.410079	2
308	AG2BYUtRw2g	Shatter the God's Crown (feat. Alexia Evellyn)	HOYO-MiX	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FAG2BYUtRw2g%2Fhqdefault.jpg	2026-05-07 16:29:18.858559	2
309	CE_IV8a80ow	Dragon's Dance	Erick Aleixo	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FCE_IV8a80ow%2Fhqdefault.jpg	2026-05-07 16:29:25.365818	2
310	CE_IV8a80ow	Dragon's Dance	Erick Aleixo	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FCE_IV8a80ow%2Fhqdefault.jpg	2026-05-07 16:29:45.447545	2
311	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-07 17:01:49.908665	2
312	clip:93cbdd02ec52	testyy	Slayer	/clip-cover.svg	2026-05-07 17:54:47.097464	2
313	jqnC54vbUbU	Slayer - War Ensemble	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FjqnC54vbUbU%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLALnimqOEtVm4k69yu52AIiJ1vPoQ	2026-05-07 17:55:02.328731	2
314	clip:93cbdd02ec52	testyy	Slayer	/clip-cover.svg	2026-05-07 17:55:06.184906	2
315	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FW3q8Od5qJio%2Fhqdefault.jpg	2026-05-07 17:55:35.110385	2
316	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FW3q8Od5qJio%2Fhqdefault.jpg	2026-05-07 17:55:48.976508	2
317	clip:00eab4697017	Rammstein - Du Hast (Official 4K Video)	Rammstein	/clip-cover.svg	2026-05-07 17:55:54.213018	2
318	clip:257668d9dd06	Rammstein - Du Hast (Offici	Rammstein	/clip-cover.svg	2026-05-07 17:56:26.361805	2
319	clip:00eab4697017	Rammstein - Du Hast (Official 4K Video)	Rammstein	/clip-cover.svg	2026-05-07 17:56:39.48356	2
320	TnRZhLRv6eM	Angel Of Death	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTnRZhLRv6eM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLD4ZUSb6onPylwc1Yw2QwXRSfFv6A	2026-05-07 17:56:51.784793	2
321	clip:69eb67c1ec8e	Angel Of Death	Slayer	/clip-cover.svg	2026-05-07 17:57:09.946404	2
322	jqnC54vbUbU	Slayer - War Ensemble	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FjqnC54vbUbU%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLALnimqOEtVm4k69yu52AIiJ1vPoQ	2026-05-07 17:57:30.958602	2
323	clip:c4f5f664082e	tests	Slayer	/clip-cover.svg	2026-05-07 17:57:47.337766	2
324	clip:c4f5f664082e	tests	Slayer	/clip-cover.svg	2026-05-07 18:27:04.959447	2
325	clip:c4f5f664082e	tests	Slayer	/clip-cover.svg	2026-05-07 18:27:12.005413	2
326	TnRZhLRv6eM	Angel Of Death	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTnRZhLRv6eM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLD4ZUSb6onPylwc1Yw2QwXRSfFv6A	2026-05-07 18:27:15.55175	2
327	clip:c4f5f664082e	tests	Slayer	/clip-cover.svg	2026-05-07 18:27:17.030393	2
328	clip:c4f5f664082e	tests	Slayer	/clip-cover.svg	2026-05-07 18:28:36.076954	2
329	TnRZhLRv6eM	Angel Of Death	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTnRZhLRv6eM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLD4ZUSb6onPylwc1Yw2QwXRSfFv6A	2026-05-07 18:28:41.616467	2
330	clip:c4f5f664082e	tests	Slayer	/clip-cover.svg	2026-05-07 18:28:41.882107	2
331	TnRZhLRv6eM	Angel Of Death	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTnRZhLRv6eM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLD4ZUSb6onPylwc1Yw2QwXRSfFv6A	2026-05-07 18:28:49.136713	2
332	clip:c4f5f664082e	tests	Slayer	/clip-cover.svg	2026-05-07 18:28:52.938564	2
333	TnRZhLRv6eM	Angel Of Death	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTnRZhLRv6eM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLD4ZUSb6onPylwc1Yw2QwXRSfFv6A	2026-05-07 18:33:09.003802	2
334	TnRZhLRv6eM	Angel Of Death	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTnRZhLRv6eM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLD4ZUSb6onPylwc1Yw2QwXRSfFv6A	2026-05-07 18:33:29.287947	2
335	clip:85106b0c850a	cxcxcx	Slayer	/clip-cover.svg	2026-05-07 18:34:22.214629	2
546	0qanF-91aJo	Paranoid	Black Sabbath	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2F0qanF-91aJo%2Fhqdefault.jpg	2026-05-08 16:47:50.50272	2
336	TnRZhLRv6eM	Angel Of Death	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTnRZhLRv6eM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLD4ZUSb6onPylwc1Yw2QwXRSfFv6A	2026-05-07 18:34:25.098893	2
337	clip:c4f5f664082e	tests	Slayer	/clip-cover.svg	2026-05-07 18:34:32.07905	2
338	clip:85106b0c850a	cxcxcx	Slayer	/clip-cover.svg	2026-05-07 18:34:34.543993	2
339	clip:85106b0c850a	cxcxcx	Slayer	/clip-cover.svg	2026-05-07 18:46:00.59494	2
340	clip:c4f5f664082e	tests	Slayer	/clip-cover.svg	2026-05-07 18:46:04.329357	2
341	TnRZhLRv6eM	Angel Of Death	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTnRZhLRv6eM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLD4ZUSb6onPylwc1Yw2QwXRSfFv6A	2026-05-07 18:46:06.729837	2
342	clip:c4f5f664082e	tests	Slayer	/clip-cover.svg	2026-05-07 18:50:35.440612	2
343	3mbvWn1EY6g	Ace of Spades	Motörhead	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2F3mbvWn1EY6g%2Fhqdefault.jpg	2026-05-07 18:58:29.821225	2
344	TnRZhLRv6eM	Angel Of Death	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTnRZhLRv6eM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLD4ZUSb6onPylwc1Yw2QwXRSfFv6A	2026-05-07 18:58:49.191558	2
345	clip:ec2e85223549	1clip	Slayer	/clip-cover.svg	2026-05-07 18:59:17.168472	2
346	clip:ec2e85223549	1clip	Slayer	/clip-cover.svg	2026-05-07 18:59:23.795769	2
347	clip:ec2e85223549	1clip	Slayer	/clip-cover.svg	2026-05-07 19:09:30.116873	2
348	3mbvWn1EY6g	Ace of Spades	Motörhead	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2F3mbvWn1EY6g%2Fhqdefault.jpg	2026-05-07 19:09:41.87769	2
349	clip:5a3127be9b88	Ace of Spades	Motörhead	/clip-cover.svg	2026-05-07 19:09:56.213366	2
350	clip:5a3127be9b88	Ace of Spades	Motörhead	/clip-cover.svg	2026-05-07 19:10:10.105463	2
351	clip:5a3127be9b88	Ace of Spades	Motörhead	/clip-cover.svg	2026-05-07 19:10:50.910652	2
352	clip:5a3127be9b88	Ace of Spades	Motörhead	/clip-cover.svg	2026-05-07 19:28:21.212665	2
353	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-07 19:28:31.085247	2
354	clip:67c4e0449db7	If Darkness Had a Sonkjhgyft	Metallica	/clip-cover.svg	2026-05-07 19:28:48.182711	2
355	clip:67c4e0449db7	If Darkness Had a Sonkjhgyft	Metallica	/clip-cover.svg	2026-05-07 19:28:53.206259	2
356	clip:67c4e0449db7	If Darkness Had a Sonkjhgyft	Metallica	/clip-cover.svg	2026-05-07 19:33:24.752336	2
357	TnRZhLRv6eM	Angel Of Death	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTnRZhLRv6eM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLD4ZUSb6onPylwc1Yw2QwXRSfFv6A	2026-05-07 19:33:46.307453	2
358	yjb0j9l1sz4	SLAYER - Repentless (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2Fyjb0j9l1sz4%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLAq1J9xoO6yXpyjTM0l5lJk7Cc54A	2026-05-07 19:33:53.669206	2
359	TnRZhLRv6eM	Angel Of Death	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTnRZhLRv6eM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLD4ZUSb6onPylwc1Yw2QwXRSfFv6A	2026-05-07 19:33:58.85998	2
360	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:34:28.753962	2
361	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:35:15.974924	2
362	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:35:36.116329	2
363	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:35:40.736173	2
364	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:35:42.055439	2
365	TnRZhLRv6eM	Angel Of Death	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTnRZhLRv6eM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLD4ZUSb6onPylwc1Yw2QwXRSfFv6A	2026-05-07 19:35:45.061992	2
366	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:35:48.010435	2
367	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:35:51.984779	2
368	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:39:56.750438	2
369	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:40:27.287801	2
370	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:40:33.272327	2
371	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FW3q8Od5qJio%2Fhqdefault.jpg	2026-05-07 19:40:52.292693	2
372	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:40:56.830456	2
373	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:41:01.38619	2
374	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-07 19:41:18.390702	2
375	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:41:19.116226	2
376	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:44:53.998009	2
377	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:49:40.357333	2
378	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:49:57.548359	2
379	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:50:10.061969	2
380	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:53:55.733123	2
381	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:54:03.869277	2
382	3mbvWn1EY6g	Ace of Spades	Motörhead	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2F3mbvWn1EY6g%2Fhqdefault.jpg	2026-05-07 19:54:14.181113	2
383	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:54:16.388492	2
384	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:54:17.752023	2
385	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:54:19.896411	2
386	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 19:54:21.974976	2
387	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-07 20:05:11.70775	2
388	clip:60c448caa3b6	koool	Gojira	/clip-cover.svg	2026-05-07 20:05:31.781007	2
389	clip:977e5600c27d	"1	Slayer	/clip-cover.svg	2026-05-07 20:05:37.004475	2
390	clip:60c448caa3b6	koool	Gojira	/clip-cover.svg	2026-05-07 20:05:42.283182	2
391	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-07 20:05:48.060234	2
392	clip:60c448caa3b6	koool	Gojira	/clip-cover.svg	2026-05-07 20:05:50.172184	2
393	clip:60c448caa3b6	koool	Gojira	/clip-cover.svg	2026-05-07 20:05:53.686671	2
394	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-07 20:06:05.073391	2
395	clip:60c448caa3b6	koool	Gojira	/clip-cover.svg	2026-05-07 20:06:05.256125	2
399	clip:60c448caa3b6	koool	Gojira	/clip-cover.svg	2026-05-07 20:06:20.346384	2
396	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-07 20:06:13.34183	2
397	clip:60c448caa3b6	koool	Gojira	/clip-cover.svg	2026-05-07 20:06:14.087184	2
398	clip:60c448caa3b6	koool	Gojira	/clip-cover.svg	2026-05-07 20:06:17.907813	2
420	clip:60c448caa3b6	koool	Gojira	/clip-cover.svg	2026-05-08 14:40:45.240712	2
421	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 14:40:48.657381	2
422	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-08 14:40:56.913121	2
423	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 14:40:58.465728	2
424	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-08 14:40:59.6359	2
425	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 14:41:00.245357	2
426	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-08 14:41:01.454925	2
427	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-08 14:41:02.265419	2
428	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-08 14:41:06.317244	2
429	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-08 14:41:50.896144	2
430	clip:3548ff1e3716	0987	Metallica	/clip-cover.svg	2026-05-08 14:42:17.721449	2
431	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 14:42:28.220752	2
432	clip:3548ff1e3716	0987	Metallica	/clip-cover.svg	2026-05-08 14:42:30.702034	2
433	clip:3548ff1e3716	0987	Metallica	/clip-cover.svg	2026-05-08 14:42:35.817536	2
434	clip:3548ff1e3716	0987	Metallica	/clip-cover.svg	2026-05-08 14:42:39.576958	2
435	clip:3548ff1e3716	0987	Metallica	/clip-cover.svg	2026-05-08 14:44:57.485132	2
436	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 14:45:01.975715	2
437	DECp8LKurKs	Slayer - Seasons In The Abyss	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FDECp8LKurKs%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCYJ9g2JgxD1Mv09JUAYLwk1TQSNw	2026-05-08 14:45:10.308754	2
438	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 14:45:10.916351	2
439	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-08 14:45:17.064791	2
440	DECp8LKurKs	Slayer - Seasons In The Abyss	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FDECp8LKurKs%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCYJ9g2JgxD1Mv09JUAYLwk1TQSNw	2026-05-08 14:45:49.558855	2
441	3mbvWn1EY6g	Ace of Spades	Motörhead	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2F3mbvWn1EY6g%2Fhqdefault.jpg	2026-05-08 14:45:54.447618	2
442	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FQ8WJz-DmPVg%2Fhqdefault.jpg%3Fsqp%3D-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-08 14:45:59.882776	2
443	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FQ8WJz-DmPVg%2Fhqdefault.jpg%3Fsqp%3D-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-08 14:46:04.380402	2
444	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 14:47:37.577164	2
445	DECp8LKurKs	Slayer - Seasons In The Abyss	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FDECp8LKurKs%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCYJ9g2JgxD1Mv09JUAYLwk1TQSNw	2026-05-08 14:47:40.210866	2
446	clip:3548ff1e3716	0987	Metallica	/clip-cover.svg	2026-05-08 14:47:45.294816	2
447	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 14:47:52.10085	2
448	DECp8LKurKs	Slayer - Seasons In The Abyss	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FDECp8LKurKs%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCYJ9g2JgxD1Mv09JUAYLwk1TQSNw	2026-05-08 14:47:56.898006	2
449	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 14:47:58.567955	2
450	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 14:49:11.580807	2
451	DECp8LKurKs	Slayer - Seasons In The Abyss	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FDECp8LKurKs%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCYJ9g2JgxD1Mv09JUAYLwk1TQSNw	2026-05-08 14:49:13.908169	2
453	clip:3548ff1e3716	0987	Metallica	/clip-cover.svg	2026-05-08 14:49:22.996618	2
454	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 14:49:28.562069	2
455	DECp8LKurKs	Slayer - Seasons In The Abyss	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FDECp8LKurKs%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCYJ9g2JgxD1Mv09JUAYLwk1TQSNw	2026-05-08 14:49:30.567121	2
456	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-08 14:49:34.56922	2
457	clip:3548ff1e3716	0987	Metallica	/clip-cover.svg	2026-05-08 14:49:38.302961	2
458	clip:3548ff1e3716	0987	Metallica	/clip-cover.svg	2026-05-08 14:50:35.53881	2
459	clip:3548ff1e3716	0987	Metallica	/clip-cover.svg	2026-05-08 14:50:49.445002	2
460	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 14:53:36.901798	2
461	DECp8LKurKs	Slayer - Seasons In The Abyss	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FDECp8LKurKs%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCYJ9g2JgxD1Mv09JUAYLwk1TQSNw	2026-05-08 14:53:41.212222	2
462	clip:3548ff1e3716	0987	Metallica	/clip-cover.svg	2026-05-08 14:53:46.378777	2
463	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 14:54:46.890694	2
464	clip:3c2922c0c495	cvv	Slayer	/clip-cover.svg	2026-05-08 14:55:15.23921	2
465	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-08 14:56:59.155887	2
466	DECp8LKurKs	Slayer - Seasons In The Abyss	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FDECp8LKurKs%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCYJ9g2JgxD1Mv09JUAYLwk1TQSNw	2026-05-08 15:02:26.766192	2
467	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FW3q8Od5qJio%2Fhqdefault.jpg	2026-05-08 15:03:11.735159	2
468	DECp8LKurKs	Slayer - Seasons In The Abyss	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FDECp8LKurKs%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCYJ9g2JgxD1Mv09JUAYLwk1TQSNw	2026-05-08 15:03:16.554452	2
469	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FW3q8Od5qJio%2Fhqdefault.jpg	2026-05-08 15:04:16.762263	2
470	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:04:34.61354	2
471	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-08 15:04:38.793759	2
472	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:07:25.465348	2
473	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:07:40.381708	2
474	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:07:49.713674	2
475	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:08:02.226779	2
476	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:08:18.120856	2
477	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-08 15:13:50.245008	2
478	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-08 15:13:56.891137	2
479	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-08 15:14:02.325694	2
480	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:14:10.809122	2
481	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FQ8WJz-DmPVg%2Fhqdefault.jpg%3Fsqp%3D-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-08 15:17:29.739571	2
482	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-08 15:18:27.172221	2
483	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-08 15:18:35.113968	2
544	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FW3q8Od5qJio%2Fhqdefault.jpg	2026-05-08 16:40:07.438382	2
484	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-08 15:18:40.794194	2
485	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-08 15:18:47.78778	2
486	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-08 15:19:12.498042	2
487	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-08 15:19:15.007116	2
488	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-08 15:19:20.879643	2
489	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-08 15:19:28.512028	2
490	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:21:22.444267	2
491	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FW3q8Od5qJio%2Fhqdefault.jpg	2026-05-08 15:21:30.247703	2
492	0qanF-91aJo	Paranoid	Black Sabbath	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2F0qanF-91aJo%2Fhqdefault.jpg	2026-05-08 15:21:34.943287	2
493	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FW3q8Od5qJio%2Fhqdefault.jpg	2026-05-08 15:21:35.86559	2
494	dQ_-tUKT-nY	Conquer Or Die (Official Video)	Megadeth	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FdQ_-tUKT-nY%2Fhqdefault.jpg	2026-05-08 15:21:38.474732	2
495	0qanF-91aJo	Paranoid	Black Sabbath	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2F0qanF-91aJo%2Fhqdefault.jpg	2026-05-08 15:21:41.557734	2
496	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FW3q8Od5qJio%2Fhqdefault.jpg	2026-05-08 15:21:42.183094	2
497	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FW3q8Od5qJio%2Fhqdefault.jpg	2026-05-08 15:21:44.848936	2
498	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-08 15:21:47.958217	2
499	0qanF-91aJo	Paranoid	Black Sabbath	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2F0qanF-91aJo%2Fhqdefault.jpg	2026-05-08 15:21:52.54189	2
500	3mbvWn1EY6g	Ace of Spades	Motörhead	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2F3mbvWn1EY6g%2Fhqdefault.jpg	2026-05-08 15:21:56.590341	2
501	0qanF-91aJo	Paranoid	Black Sabbath	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2F0qanF-91aJo%2Fhqdefault.jpg	2026-05-08 15:21:57.521542	2
502	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FW3q8Od5qJio%2Fhqdefault.jpg	2026-05-08 15:21:57.730694	2
503	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:22:08.892072	2
504	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:23:15.036467	2
505	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:23:22.423355	2
506	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:23:30.341245	2
507	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:24:49.741408	2
508	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FW3q8Od5qJio%2Fhqdefault.jpg	2026-05-08 15:24:55.201112	2
509	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:24:55.923606	2
510	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:26:18.988172	2
511	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:26:24.817624	2
512	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:26:43.054096	2
513	0qanF-91aJo	Paranoid	Black Sabbath	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2F0qanF-91aJo%2Fhqdefault.jpg	2026-05-08 15:26:46.333212	2
514	dQ_-tUKT-nY	Conquer Or Die (Official Video)	Megadeth	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FdQ_-tUKT-nY%2Fhqdefault.jpg	2026-05-08 15:26:51.200159	2
515	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FW3q8Od5qJio%2Fhqdefault.jpg	2026-05-08 15:26:59.393231	2
545	0qanF-91aJo	Paranoid	Black Sabbath	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2F0qanF-91aJo%2Fhqdefault.jpg	2026-05-08 16:40:09.418821	2
516	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:27:05.951405	2
517	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:27:33.307726	2
518	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:30:15.513369	2
519	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:31:16.43617	2
520	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:32:55.68577	2
521	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:34:10.236233	2
522	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:38:22.901168	2
523	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FW3q8Od5qJio%2Fhqdefault.jpg	2026-05-08 15:39:16.671402	2
524	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FW3q8Od5qJio%2Fhqdefault.jpg	2026-05-08 15:39:51.603943	2
525	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:40:13.121655	2
526	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:40:40.58059	2
527	3mbvWn1EY6g	Ace of Spades	Motörhead	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2F3mbvWn1EY6g%2Fhqdefault.jpg	2026-05-08 15:40:52.9526	2
528	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 15:41:34.035232	2
529	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 16:23:34.499706	2
530	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 16:32:59.100599	2
531	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-08 16:33:03.304693	2
532	jqnC54vbUbU	Slayer - War Ensemble	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FjqnC54vbUbU%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLALnimqOEtVm4k69yu52AIiJ1vPoQ	2026-05-08 16:33:06.717953	2
533	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-08 16:33:08.167842	2
534	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FW3q8Od5qJio%2Fhqdefault.jpg	2026-05-08 16:36:02.931151	2
535	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FW3q8Od5qJio%2Fhqdefault.jpg	2026-05-08 16:36:07.390987	2
536	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 16:37:01.068282	2
537	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 16:37:09.323121	2
538	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 16:38:48.461444	2
539	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 16:38:52.582405	2
540	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 16:39:08.328338	2
541	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 16:39:16.34313	2
542	W3q8Od5qJio	Rammstein - Du Hast (Official 4K Video)	Rammstein	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FW3q8Od5qJio%2Fhqdefault.jpg	2026-05-08 16:39:39.805563	2
543	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 16:40:02.634305	2
547	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FQ8WJz-DmPVg%2Fhqdefault.jpg%3Fsqp%3D-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-08 16:48:59.412012	2
548	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FQ8WJz-DmPVg%2Fhqdefault.jpg%3Fsqp%3D-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-08 16:49:01.715384	2
549	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FQ8WJz-DmPVg%2Fhqdefault.jpg%3Fsqp%3D-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-08 16:49:03.305197	2
550	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FQ8WJz-DmPVg%2Fhqdefault.jpg%3Fsqp%3D-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-08 16:49:07.227112	2
551	0qanF-91aJo	Paranoid	Black Sabbath	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2F0qanF-91aJo%2Fhqdefault.jpg	2026-05-08 16:49:22.884395	2
552	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 16:49:32.873061	2
553	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FQ8WJz-DmPVg%2Fhqdefault.jpg%3Fsqp%3D-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-08 16:49:34.878176	2
554	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-08 16:49:40.612766	2
555	3mbvWn1EY6g	Ace of Spades	Motörhead	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2F3mbvWn1EY6g%2Fhqdefault.jpg	2026-05-08 16:49:47.21586	2
556	DECp8LKurKs	Slayer - Seasons In The Abyss	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FDECp8LKurKs%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLCYJ9g2JgxD1Mv09JUAYLwk1TQSNw	2026-05-08 16:51:51.063335	2
557	yjb0j9l1sz4	SLAYER - Repentless (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2Fyjb0j9l1sz4%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLAq1J9xoO6yXpyjTM0l5lJk7Cc54A	2026-05-08 17:01:20.236093	2
558	jqnC54vbUbU	Slayer - War Ensemble	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FjqnC54vbUbU%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLALnimqOEtVm4k69yu52AIiJ1vPoQ	2026-05-08 17:21:14.479568	2
559	jqnC54vbUbU	Slayer - War Ensemble	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FjqnC54vbUbU%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLALnimqOEtVm4k69yu52AIiJ1vPoQ	2026-05-08 17:24:10.55896	2
560	iVvXB-Vwnco	Gojira - Silvera [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDNztskmDWnzlTHA4UwTj54Jfo5Lg	2026-05-08 17:30:49.097101	2
561	jqnC54vbUbU	Slayer - War Ensemble	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FjqnC54vbUbU%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLALnimqOEtVm4k69yu52AIiJ1vPoQ	2026-05-08 17:31:43.045006	2
562	i2r9-Aa-FiE	Wing and A Prayer	Tim Mosher	/api/images/proxy?u=https%3A%2F%2Fyt3.googleusercontent.com%2F6qau-0DS5SlfVxzWbt-osjfY_mEMlPY7oo7qWwwEQgvMjBTwT7jVw_lLW8Lxd6dy7AgEsT3x5OaGao2WJw%3Ds512-c-k-c0x00ffffff-no-rj	2026-05-08 20:34:49.964269	13
563	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 21:24:39.927485	2
564	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-08 21:24:46.104996	2
565	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-08 21:24:50.934147	2
566	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 21:26:46.312288	2
567	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-08 21:27:09.496873	2
568	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-08 21:30:08.926586	2
569	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-08 21:30:11.460848	2
570	jqnC54vbUbU	Slayer - War Ensemble	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FjqnC54vbUbU%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLALnimqOEtVm4k69yu52AIiJ1vPoQ	2026-05-09 20:12:40.300392	2
571	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-09 20:13:01.79329	2
572	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FQ8WJz-DmPVg%2Fhqdefault.jpg%3Fsqp%3D-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-09 20:13:07.237064	2
573	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	2026-05-09 20:13:12.84012	2
574	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-09 20:14:36.788038	2
575	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-09 20:14:41.999668	2
576	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-09 20:14:49.498694	2
577	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-09 20:15:01.226539	2
578	jqnC54vbUbU	Slayer - War Ensemble	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FjqnC54vbUbU%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLALnimqOEtVm4k69yu52AIiJ1vPoQ	2026-05-09 20:15:04.10825	2
579	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-09 20:15:04.448175	2
580	4wUW4t-GbNs	BEST HEAVY METAL 2026: Brutal Steel Riffs and Dark Epic Energy	GavlecEcho	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2F4wUW4t-GbNs%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLBS6-kDGueg32BIOJ4h3Shw2hXpIw	2026-05-09 21:02:18.96929	2
581	g9VcZpTjxao	Dead Embryonic Cells	Sepultura	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2Fg9VcZpTjxao%2Fhqdefault.jpg	2026-05-09 21:10:12.725782	2
582	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-09 21:13:01.788858	2
583	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-09 21:13:08.388924	2
584	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-09 21:13:11.264445	2
585	fTKqtvXjkvo	Top Hits 2026 ~ Trending Songs 2026 ~ Top Songs 2026 Top Music 🎶🎧	Revive Music	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FfTKqtvXjkvo%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLD77qyeo0uWireikBtxZ_h_8pPnVw	2026-05-09 21:16:46.734474	14
586	vWOz5iQpgUA	#OnThisDay in 1997, our video for 'King Nothing,' directed by Matt Mahurin, debuted...	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FvWOz5iQpgUA%2Fhqdefault.jpg	2026-05-09 21:17:05.54998	2
587	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-09 21:28:48.477313	2
588	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-09 21:28:52.703052	2
589	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-09 21:29:13.987502	2
590	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-09 21:32:35.880285	2
591	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-09 22:46:28.293597	2
592	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-09 22:46:32.273301	2
593	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-09 22:46:40.835763	2
594	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-09 22:46:55.750987	2
595	v2AC41dglnM	AC/DC - Thunderstruck (Official Video)	AC/DC	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2Fv2AC41dglnM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLB3h9kpQx4cInRC0ds_cSXp2GvoTg	2026-05-09 22:48:07.602965	2
596	v2AC41dglnM	AC/DC - Thunderstruck (Official Video)	AC/DC	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2Fv2AC41dglnM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLB3h9kpQx4cInRC0ds_cSXp2GvoTg	2026-05-09 22:49:34.5742	2
597	v2AC41dglnM	AC/DC - Thunderstruck (Official Video)	AC/DC	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2Fv2AC41dglnM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLB3h9kpQx4cInRC0ds_cSXp2GvoTg	2026-05-09 22:50:22.067368	2
598	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-09 22:51:05.950135	2
599	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FQ8WJz-DmPVg%2Fhqdefault.jpg%3Fsqp%3D-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-09 22:51:10.210788	2
600	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-09 22:53:53.89114	2
601	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-09 22:54:02.043617	2
602	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-10 10:57:08.251068	2
603	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-10 10:57:23.035966	2
604	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-10 10:57:27.634476	2
605	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	2026-05-10 10:57:27.968434	2
606	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-10 10:57:33.497889	2
607	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	2026-05-10 10:59:07.67247	2
608	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	2026-05-10 10:59:14.653339	2
609	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FQ8WJz-DmPVg%2Fhqdefault.jpg%3Fsqp%3D-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	2026-05-10 15:47:56.703838	2
\.


--
-- Data for Name: playlist_tracks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.playlist_tracks (id, track_id, title, artist, thumbnail_url, duration, added_at, playlist_id) FROM stdin;
8	B_HSa1dEL9s	For Whom The Bell Tolls (Remastered)	Metallica	https://i.ytimg.com/vi/B_HSa1dEL9s/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCH_Zm-jMudQwse7HgA9iD2K3ruBQ	310	2026-04-03 10:54:47.425386	2
10	9HZ_tx8aWuA	Fade To Black (Remastered)	Metallica	https://i.ytimg.com/vi/9HZ_tx8aWuA/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLChJWqf2IT4-F9k7wEfz3EuUYJYdQ	418	2026-04-03 10:55:00.651462	2
12	vA1nlwTbCvg	Battery	Metallica	https://yt3.googleusercontent.com/YArfdE0OKeDbWBrrps0MPrrVEzkMwu-SmUiDQV7VbfaS1eSqhA29i_IkD3RnTuG_g9MrlQQBbjCugZN0=w544-h544-l90-rj	313	2026-04-03 11:05:20.664453	2
11	6xjJ2XIbGRk	Master of Puppets	Metallica	https://yt3.googleusercontent.com/YArfdE0OKeDbWBrrps0MPrrVEzkMwu-SmUiDQV7VbfaS1eSqhA29i_IkD3RnTuG_g9MrlQQBbjCugZN0=w544-h544-l90-rj	517	2026-04-03 10:57:37.567122	2
21	iVvXB-Vwnco	Gojira - Silvera [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDNztskmDWnzlTHA4UwTj54Jfo5Lg	215	2026-05-07 13:54:59.288964	1
24	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	60	2026-05-07 16:05:34.563037	8
27	jqnC54vbUbU	Slayer - War Ensemble	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FjqnC54vbUbU%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLALnimqOEtVm4k69yu52AIiJ1vPoQ	303	2026-05-07 16:06:04.19099	8
28	TnRZhLRv6eM	Angel Of Death	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FTnRZhLRv6eM%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLD4ZUSb6onPylwc1Yw2QwXRSfFv6A	292	2026-05-07 16:06:07.612242	1
76	clip:d6dd046dc4d8	,cmlknjbhv	Slayer	/clip-cover.svg	24	2026-05-08 15:02:41.685392	9
77	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	151	2026-05-08 15:07:21.190095	9
82	clip:d372b9e66627	Wing and A Prayer,mnb	Tim Mosher	/clip-cover.svg	39	2026-05-08 20:35:08.031462	11
83	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	60	2026-05-08 21:24:10.158149	12
84	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	60	2026-05-08 21:24:23.676558	9
85	jqnC54vbUbU	Slayer - War Ensemble	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FjqnC54vbUbU%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLALnimqOEtVm4k69yu52AIiJ1vPoQ	303	2026-05-08 21:27:06.610233	9
\.


--
-- Data for Name: playlists; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.playlists (id, name, created_at, user_id) FROM stdin;
1	test1	2026-03-22 12:32:19.312531	2
2	gdfgd	2026-03-30 06:42:50.342614	3
8	test2	2026-05-07 16:05:32.227411	2
9	test3	2026-05-07 18:59:10.917568	2
11	k	2026-05-08 20:35:08.0127	13
12	bhjkiuytrewsdfghjkiolp;[n	2026-05-08 21:24:10.106616	2
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles (id, name) FROM stdin;
1	guest
2	user
\.


--
-- Data for Name: track_tags; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.track_tags (id, track_id, title, artist, thumbnail_url, tag, added_at, user_id) FROM stdin;
82	jqnC54vbUbU	Slayer - War Ensemble	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FjqnC54vbUbU%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLALnimqOEtVm4k69yu52AIiJ1vPoQ	пвап	2026-05-08 17:21:18.904606	2
83	jqnC54vbUbU	Slayer - War Ensemble	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FjqnC54vbUbU%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLALnimqOEtVm4k69yu52AIiJ1vPoQ	fdggdfg	2026-05-08 17:29:05.961759	2
84	jqnC54vbUbU	Slayer - War Ensemble	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FjqnC54vbUbU%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLALnimqOEtVm4k69yu52AIiJ1vPoQ	gdfg	2026-05-08 17:29:07.403153	2
85	jqnC54vbUbU	Slayer - War Ensemble	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FjqnC54vbUbU%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLALnimqOEtVm4k69yu52AIiJ1vPoQ	блдто	2026-05-08 17:29:08.364018	2
19	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	dsfgfhgfj	2026-04-28 14:25:23.786264	2
23	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	https://i.ytimg.com/vi/FNdC_3LR2AI/hq720.jpg?sqp=-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	mklnjbkh	2026-04-28 14:27:03.160786	2
26	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	https://i.ytimg.com/vi/Q8WJz-DmPVg/hqdefault.jpg?sqp=-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	njbh	2026-04-28 14:27:14.934267	2
29	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	mklnjbkh	2026-05-07 13:54:26.183251	2
32	clip:d6dd046dc4d8	,cmlknjbhv	Slayer	/clip-cover.svg	dsfgfhgfj	2026-05-08 15:13:45.923124	2
34	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	dafdsgfdhgfndaf	2026-05-08 16:42:13.463744	2
35	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	dasfdsgfdhgfhda	2026-05-08 16:42:17.010782	2
36	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	dafdsgfdhgfasfg	2026-05-08 16:42:19.566604	2
37	Gvyq6xYPwos	SLAYER - Dittohead (OFFICIAL MUSIC VIDEO)	Slayer	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FGvyq6xYPwos%2Fhqdefault.jpg%3Fsqp%3D-oaymwE2COADEI4CSFXyq4qpAygIARUAAIhCGAFwAcABBvABAfgB3gOAAugCigIMCAAQARhaIFAoZTAP%26rs%3DAOn4CLDlMm4qSIuq_4KZniD1-4xEvaQjnA	dafdsgfdhgffasg	2026-05-08 16:42:21.482824	2
63	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	afdsgfdhgf	2026-05-08 16:53:09.570707	2
64	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	afdsgfdhg	2026-05-08 16:53:10.64326	2
65	iVvXB-Vwnco	Silvera	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FiVvXB-Vwnco%2Fhqdefault.jpg	adfdsgfdhg	2026-05-08 16:53:11.539086	2
66	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FQ8WJz-DmPVg%2Fhqdefault.jpg%3Fsqp%3D-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	afdsgfdh	2026-05-08 16:53:16.562168	2
67	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FQ8WJz-DmPVg%2Fhqdefault.jpg%3Fsqp%3D-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	dafdsgfd	2026-05-08 16:53:17.474837	2
68	Q8WJz-DmPVg	МакSим - Знаешь ли ты (официальный клип)	Maksim	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FQ8WJz-DmPVg%2Fhqdefault.jpg%3Fsqp%3D-oaymwEcCOADEI4CSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDWLZhPJc5_h0woamgJWQpibFJPaQ	vcvbvb	2026-05-08 16:53:18.711331	2
69	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	dsf	2026-05-08 16:53:30.19543	2
70	FNdC_3LR2AI	Gojira - Stranded [OFFICIAL VIDEO]	Gojira	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFNdC_3LR2AI%2Fhq720.jpg%3Fsqp%3D-oaymwEcCOgCEMoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg%3D%3D%26rs%3DAOn4CLDzkDOAImu_IkeRWi8_Oz-aCvKFWg	gfdgg	2026-05-08 16:53:31.305559	2
79	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	блдто	2026-05-08 17:15:31.604413	2
80	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	жэлджол	2026-05-08 17:15:34.796166	2
81	FIjovoSjgH4	If Darkness Had a Son	Metallica	/api/images/proxy?u=https%3A%2F%2Fi.ytimg.com%2Fvi%2FFIjovoSjgH4%2Fhqdefault.jpg	дьжлдтоли	2026-05-08 17:15:36.677586	2
\.


--
-- Data for Name: user_mix_preferences; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_mix_preferences (id, slots, updated_at, user_id) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, email, password_hash, is_blocked, created_at, role_id) FROM stdin;
1	test	test@test.com	$2b$10$touWxY8its7kYQZ.dLs86er1cjlf/7iqX2bdIDNcRL8H4vmjeIeHu	f	2026-03-22 09:53:41.833192	2
2	user1	user1@gmail.com	$2b$10$bCcKCVAc3yYeJtqcQWkpPOF6.f6KC8EPxACoQa0cxcNUYybyP0vZm	f	2026-03-22 12:02:02.485364	2
3	user2	user2@gmail.com	$2b$10$BmugSKjcFRL3.4PXxsFsbu7XC717OUAxK1iTx76WMUgHs9BbVk4Tm	f	2026-03-29 14:03:13.738511	2
4	user3	usesr3@gmail.com	$2b$10$.n.5qDrz10uXsf8CkI1Fkeq9jsuBdrhVMiHT2bFKpOXKf91ochVDm	f	2026-05-08 15:08:58.166774	2
5	user3	user333@gmail.com	$2b$10$AZubpcm2Ca1S.66NVFXaleby86Et/1V/OTKLnkpfB..EkiByg.dhO	f	2026-05-08 15:11:02.535444	2
6	user1	user4@gmail.com	$2b$10$hu3IWXnZt1BHRdPvbBxDceOebg.GrTmEB3zr1ycvoU.qexwR20rP2	f	2026-05-08 17:42:33.012594	2
7	user1t654	usergg2@gmail.com	$2b$10$rFLc2uqQFe.bPkkSCMp6j.8/i/JsiPUjKIrsuZG2EXvzCiwd4pUDu	f	2026-05-08 17:43:47.503945	2
8	user1	user5@gmail.com	$2b$10$bd3LBIA26LV3rJLxGNwS3ecw31ZQ6daoU7yAwuK7w9BjCmFr0nqg2	f	2026-05-08 17:44:31.046896	2
9	user1f	userf@gmail.com	$2b$10$Dyzv3a/0O2Fs5tsx9mUlpOS582QsWUozo2fk.BxssEjJa1t2624oe	f	2026-05-08 18:02:43.536236	2
10	user1ff	user1@gmail.comr	$2b$10$BS9NrFUxwjJUQu8R2U/dAu29YEYaFpa.B5wHFWljG9MvUtXSxRdxW	f	2026-05-08 20:03:38.857975	2
11	ooo	ooo@o.o	$2b$10$sp5jaPYW7.JbnC1QMukgvOpVwD25PtUq7DAtrH0DWgp6nU6SFiEIS	f	2026-05-08 20:18:11.517896	2
12	aaa	aaa@aaa.a	$2b$10$6aEMiOiLb2TrTwp5EzfMder8BgZsjrjjlYhLJtSRHumfcWzJ.13/6	f	2026-05-08 20:26:03.363156	2
13	ccc	ccc@c.c	$2b$10$SkheSW/SS91Qav/Ry6L.S.zWPgKKJydWMhA98noi/sFz2WHId1hq2	f	2026-05-08 20:33:33.869089	2
14	lll	ll@ll.l	$2b$10$MZGUcYV2F35n4bvAx982.OgwOz5X7Ll.Zy2Y5UU7LSg8UchgJ5bcO	f	2026-05-09 21:13:53.616288	2
15	pop	pop@gmail.com	$2b$10$kVxc.yB4QEFRF2KbL/4ZIeyI9yqFZLL1z5GCqsSKbjQCQHzUaGk8S	f	2026-05-09 22:54:27.667676	2
\.


--
-- Name: clips_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.clips_id_seq', 101, true);


--
-- Name: favorite_tracks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.favorite_tracks_id_seq', 41, true);


--
-- Name: listen_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.listen_history_id_seq', 609, true);


--
-- Name: playlist_tracks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.playlist_tracks_id_seq', 85, true);


--
-- Name: playlists_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.playlists_id_seq', 13, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roles_id_seq', 2, true);


--
-- Name: track_tags_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.track_tags_id_seq', 90, true);


--
-- Name: user_mix_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_mix_preferences_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 15, true);


--
-- Name: playlist_tracks PK_0f93b1a2df4de2e5b48c1459617; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_tracks
    ADD CONSTRAINT "PK_0f93b1a2df4de2e5b48c1459617" PRIMARY KEY (id);


--
-- Name: user_mix_preferences PK_65c479fd39a549e4bef426e357b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_mix_preferences
    ADD CONSTRAINT "PK_65c479fd39a549e4bef426e357b" PRIMARY KEY (id);


--
-- Name: track_tags PK_82814b03a02ca7574af95674114; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_tags
    ADD CONSTRAINT "PK_82814b03a02ca7574af95674114" PRIMARY KEY (id);


--
-- Name: favorite_tracks PK_8d34ad5c55c7d5448fad8c4ced7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_tracks
    ADD CONSTRAINT "PK_8d34ad5c55c7d5448fad8c4ced7" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: playlists PK_a4597f4189a75d20507f3f7ef0d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlists
    ADD CONSTRAINT "PK_a4597f4189a75d20507f3f7ef0d" PRIMARY KEY (id);


--
-- Name: listen_history PK_a843bc2e94502f8432de79783c3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listen_history
    ADD CONSTRAINT "PK_a843bc2e94502f8432de79783c3" PRIMARY KEY (id);


--
-- Name: roles PK_c1433d71a4838793a49dcad46ab; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY (id);


--
-- Name: clips PK_cdb959a37f95935a5d30460dc3c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clips
    ADD CONSTRAINT "PK_cdb959a37f95935a5d30460dc3c" PRIMARY KEY (id);


--
-- Name: users UQ_97672ac88f789774dd47f7c8be3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);


--
-- Name: clips UQ_a933e0e6838502aca375a9de71f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clips
    ADD CONSTRAINT "UQ_a933e0e6838502aca375a9de71f" UNIQUE (short_code);


--
-- Name: favorite_tracks FK_3af7a3ee5333d4db9a85133b87a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_tracks
    ADD CONSTRAINT "FK_3af7a3ee5333d4db9a85133b87a" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: clips FK_64dabc2724586a260ce3c893208; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clips
    ADD CONSTRAINT "FK_64dabc2724586a260ce3c893208" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: track_tags FK_67febdcc6d9fdda82f343b9e72d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_tags
    ADD CONSTRAINT "FK_67febdcc6d9fdda82f343b9e72d" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: playlist_tracks FK_7ef165e08a3b87eae8cf4275cda; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_tracks
    ADD CONSTRAINT "FK_7ef165e08a3b87eae8cf4275cda" FOREIGN KEY (playlist_id) REFERENCES public.playlists(id);


--
-- Name: users FK_a2cecd1a3531c0b041e29ba46e1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1" FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: playlists FK_a3ea169575c25e5c55494d7f382; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlists
    ADD CONSTRAINT "FK_a3ea169575c25e5c55494d7f382" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: listen_history FK_a56c8e49a0310e5804c4ccba3e7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listen_history
    ADD CONSTRAINT "FK_a56c8e49a0310e5804c4ccba3e7" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_mix_preferences FK_a9affaad17d70b22e017553d896; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_mix_preferences
    ADD CONSTRAINT "FK_a9affaad17d70b22e017553d896" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 7v5qeYuJlTEV9ol71NtGOUjPABzaustvdIvfpPYXS81UzygPxpCuTVvKR7QmFks

