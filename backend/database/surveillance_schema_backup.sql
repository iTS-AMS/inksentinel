--
-- PostgreSQL database dump
--

\restrict t5BncYi6k4YnvdLPu0ZcAQnonKb1Efr3O04cJSWYaSY4IGtqdUVi3KiLJFeJ1lb

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

-- Started on 2026-04-26 18:53:30

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 233 (class 1259 OID 79435)
-- Name: detections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.detections (
    id integer NOT NULL,
    session_id integer,
    feed_id integer,
    detected_at timestamp with time zone NOT NULL,
    class_label text NOT NULL,
    confidence double precision,
    alert_clip_path text,
    image_reference text,
    notes text,
    CONSTRAINT detections_confidence_check CHECK (((confidence >= (0)::double precision) AND (confidence <= (1)::double precision)))
);


ALTER TABLE public.detections OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 79399)
-- Name: session_feeds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session_feeds (
    id integer NOT NULL,
    session_id integer,
    feed_id integer,
    feed_label text NOT NULL,
    candidate_name text,
    connected_at timestamp with time zone DEFAULT now(),
    student_id integer,
    time_remaining_ms bigint,
    student_status text DEFAULT 'present'::text NOT NULL,
    CONSTRAINT session_feeds_student_status_check CHECK ((student_status = ANY (ARRAY['present'::text, 'absent'::text, 'submitted'::text, 'flagged'::text, 'paused'::text])))
);


ALTER TABLE public.session_feeds OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 79526)
-- Name: ai_alerts; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.ai_alerts AS
 SELECT d.id,
    d.feed_id AS student_feed_id,
    sf.student_id,
    d.detected_at AS "timestamp",
    d.class_label AS label_detected,
    d.confidence,
    d.image_reference,
    d.alert_clip_path,
    d.session_id,
    d.notes
   FROM (public.detections d
     LEFT JOIN public.session_feeds sf ON (((sf.feed_id = d.feed_id) AND (sf.session_id = d.session_id))));


ALTER VIEW public.ai_alerts OWNER TO postgres;

--
-- TOC entry 250 (class 1259 OID 79622)
-- Name: camera_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.camera_links (
    id integer NOT NULL,
    seat_label text NOT NULL,
    feed_id integer,
    camera_id text,
    feed_label text,
    status text DEFAULT 'free'::text NOT NULL,
    linked_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT camera_links_status_check CHECK ((status = ANY (ARRAY['linked'::text, 'free'::text, 'disconnected'::text])))
);


ALTER TABLE public.camera_links OWNER TO postgres;

--
-- TOC entry 249 (class 1259 OID 79621)
-- Name: camera_links_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.camera_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.camera_links_id_seq OWNER TO postgres;

--
-- TOC entry 5163 (class 0 OID 0)
-- Dependencies: 249
-- Name: camera_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.camera_links_id_seq OWNED BY public.camera_links.id;


--
-- TOC entry 219 (class 1259 OID 79271)
-- Name: courses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.courses (
    course_code text NOT NULL,
    course_name text NOT NULL,
    credits integer DEFAULT 3,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.courses OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 79434)
-- Name: detections_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.detections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.detections_id_seq OWNER TO postgres;

--
-- TOC entry 5164 (class 0 OID 0)
-- Dependencies: 232
-- Name: detections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.detections_id_seq OWNED BY public.detections.id;


--
-- TOC entry 227 (class 1259 OID 79355)
-- Name: exam_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exam_sessions (
    id integer NOT NULL,
    name text NOT NULL,
    course_name text,
    instructor_name text,
    time_block text,
    created_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone,
    duration_ms bigint,
    status text DEFAULT 'active'::text NOT NULL,
    exam_type text DEFAULT 'midterm'::text,
    section_id integer,
    deleted_at timestamp with time zone,
    CONSTRAINT exam_sessions_exam_type_check CHECK ((exam_type = ANY (ARRAY['quiz'::text, 'midterm'::text, 'final'::text, 'mock'::text]))),
    CONSTRAINT exam_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'ended'::text])))
);


ALTER TABLE public.exam_sessions OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 79354)
-- Name: exam_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.exam_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exam_sessions_id_seq OWNER TO postgres;

--
-- TOC entry 5165 (class 0 OID 0)
-- Dependencies: 226
-- Name: exam_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.exam_sessions_id_seq OWNED BY public.exam_sessions.id;


--
-- TOC entry 238 (class 1259 OID 79518)
-- Name: exam_student_sessions; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.exam_student_sessions AS
 SELECT id,
    session_id AS exam_id,
    student_id,
    time_remaining_ms AS time_remaining,
    student_status AS status,
    feed_id,
    feed_label,
    candidate_name,
    connected_at
   FROM public.session_feeds sf;


ALTER VIEW public.exam_student_sessions OWNER TO postgres;

--
-- TOC entry 248 (class 1259 OID 79607)
-- Name: exams; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.exams AS
 SELECT id,
    name,
    course_name,
    instructor_name,
    time_block,
    duration_ms AS duration,
    created_at AS start_time,
    ended_at AS end_time,
    status,
    exam_type,
    section_id
   FROM public.exam_sessions;


ALTER VIEW public.exams OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 79379)
-- Name: feeds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.feeds (
    id integer NOT NULL,
    label text NOT NULL,
    client_id text NOT NULL,
    connected boolean DEFAULT false,
    camera_id text,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);


ALTER TABLE public.feeds OWNER TO postgres;

--
-- TOC entry 251 (class 1259 OID 79646)
-- Name: feeds_available; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.feeds_available AS
 SELECT f.id,
    f.label,
    f.client_id,
    f.connected,
    f.camera_id,
    f.created_at,
    f.deleted_at,
        CASE
            WHEN f.connected THEN 'live'::text
            WHEN (f.camera_id IS NOT NULL) THEN 'available'::text
            ELSE 'unregistered'::text
        END AS availability,
    cl.seat_label AS linked_seat
   FROM (public.feeds f
     LEFT JOIN public.camera_links cl ON ((cl.feed_id = f.id)))
  WHERE (f.deleted_at IS NULL);


ALTER VIEW public.feeds_available OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 79378)
-- Name: feeds_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.feeds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.feeds_id_seq OWNER TO postgres;

--
-- TOC entry 5166 (class 0 OID 0)
-- Dependencies: 228
-- Name: feeds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.feeds_id_seq OWNED BY public.feeds.id;


--
-- TOC entry 245 (class 1259 OID 79578)
-- Name: hardware_gateways; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hardware_gateways (
    id integer NOT NULL,
    label text NOT NULL,
    ip_address text,
    last_seen timestamp with time zone DEFAULT now(),
    status text DEFAULT 'offline'::text
);


ALTER TABLE public.hardware_gateways OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 79577)
-- Name: hardware_gateways_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.hardware_gateways_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.hardware_gateways_id_seq OWNER TO postgres;

--
-- TOC entry 5167 (class 0 OID 0)
-- Dependencies: 244
-- Name: hardware_gateways_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.hardware_gateways_id_seq OWNED BY public.hardware_gateways.id;


--
-- TOC entry 237 (class 1259 OID 79485)
-- Name: signals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.signals (
    id integer NOT NULL,
    session_id integer,
    feed_id integer,
    signal text NOT NULL,
    params jsonb,
    sent_at timestamp with time zone DEFAULT now(),
    sent_by text NOT NULL,
    action_type text DEFAULT 'exam_control'::text,
    invigilator_id text,
    CONSTRAINT signals_action_type_check CHECK ((action_type = ANY (ARRAY['exam_control'::text, 'unit_control'::text, 'system'::text])))
);


ALTER TABLE public.signals OWNER TO postgres;

--
-- TOC entry 239 (class 1259 OID 79522)
-- Name: logs; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.logs AS
 SELECT id,
    sent_at AS "timestamp",
    action_type,
    invigilator_id,
    session_id,
    feed_id,
    signal AS command,
    params AS details,
    sent_by
   FROM public.signals;


ALTER VIEW public.logs OWNER TO postgres;

--
-- TOC entry 247 (class 1259 OID 79591)
-- Name: proctor_actions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.proctor_actions (
    id integer NOT NULL,
    session_id integer,
    action_type text NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.proctor_actions OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 79590)
-- Name: proctor_actions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.proctor_actions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.proctor_actions_id_seq OWNER TO postgres;

--
-- TOC entry 5168 (class 0 OID 0)
-- Dependencies: 246
-- Name: proctor_actions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.proctor_actions_id_seq OWNED BY public.proctor_actions.id;


--
-- TOC entry 221 (class 1259 OID 79283)
-- Name: sections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sections (
    section_id integer NOT NULL,
    course_code text NOT NULL,
    section_name text NOT NULL,
    initials text,
    year integer DEFAULT 2026 NOT NULL,
    year_session text NOT NULL,
    CONSTRAINT sections_year_session_check CHECK ((year_session = ANY (ARRAY['Spring'::text, 'Summer'::text, 'Fall'::text])))
);


ALTER TABLE public.sections OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 79282)
-- Name: sections_section_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sections_section_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sections_section_id_seq OWNER TO postgres;

--
-- TOC entry 5169 (class 0 OID 0)
-- Dependencies: 220
-- Name: sections_section_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sections_section_id_seq OWNED BY public.sections.section_id;


--
-- TOC entry 230 (class 1259 OID 79398)
-- Name: session_feeds_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.session_feeds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.session_feeds_id_seq OWNER TO postgres;

--
-- TOC entry 5170 (class 0 OID 0)
-- Dependencies: 230
-- Name: session_feeds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.session_feeds_id_seq OWNED BY public.session_feeds.id;


--
-- TOC entry 236 (class 1259 OID 79484)
-- Name: signals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.signals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.signals_id_seq OWNER TO postgres;

--
-- TOC entry 5171 (class 0 OID 0)
-- Dependencies: 236
-- Name: signals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.signals_id_seq OWNED BY public.signals.id;


--
-- TOC entry 225 (class 1259 OID 79329)
-- Name: student_sections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.student_sections (
    id integer NOT NULL,
    std_id text NOT NULL,
    section_id integer NOT NULL
);


ALTER TABLE public.student_sections OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 79328)
-- Name: student_sections_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.student_sections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.student_sections_id_seq OWNER TO postgres;

--
-- TOC entry 5172 (class 0 OID 0)
-- Dependencies: 224
-- Name: student_sections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.student_sections_id_seq OWNED BY public.student_sections.id;


--
-- TOC entry 223 (class 1259 OID 79307)
-- Name: students; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.students (
    id integer NOT NULL,
    name text NOT NULL,
    student_id text NOT NULL,
    email text,
    section_id integer,
    seat_number integer,
    pen_unit_id integer,
    client_id text,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);


ALTER TABLE public.students OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 79306)
-- Name: students_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.students_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.students_id_seq OWNER TO postgres;

--
-- TOC entry 5173 (class 0 OID 0)
-- Dependencies: 222
-- Name: students_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.students_id_seq OWNED BY public.students.id;


--
-- TOC entry 242 (class 1259 OID 79546)
-- Name: subjects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subjects (
    id integer NOT NULL,
    name text NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.subjects OWNER TO postgres;

--
-- TOC entry 241 (class 1259 OID 79545)
-- Name: subjects_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subjects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subjects_id_seq OWNER TO postgres;

--
-- TOC entry 5174 (class 0 OID 0)
-- Dependencies: 241
-- Name: subjects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subjects_id_seq OWNED BY public.subjects.id;


--
-- TOC entry 243 (class 1259 OID 79559)
-- Name: user_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_settings (
    user_id text NOT NULL,
    theme text DEFAULT 'system'::text,
    language text DEFAULT 'en'::text,
    font_scale integer DEFAULT 100,
    movement_threshold integer DEFAULT 45,
    audio_sensitivity integer DEFAULT 72,
    backend_api_url text DEFAULT 'http://localhost:3000'::text,
    ai_service_url text DEFAULT 'http://localhost:9999'::text,
    hardware_gateway_id integer,
    last_notification_read_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_settings OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 79461)
-- Name: video_segments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_segments (
    id integer NOT NULL,
    session_id integer,
    feed_id integer,
    file_path text NOT NULL,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    size_bytes bigint
);


ALTER TABLE public.video_segments OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 79460)
-- Name: video_segments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.video_segments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.video_segments_id_seq OWNER TO postgres;

--
-- TOC entry 5175 (class 0 OID 0)
-- Dependencies: 234
-- Name: video_segments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.video_segments_id_seq OWNED BY public.video_segments.id;


--
-- TOC entry 4881 (class 2604 OID 79625)
-- Name: camera_links id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.camera_links ALTER COLUMN id SET DEFAULT nextval('public.camera_links_id_seq'::regclass);


--
-- TOC entry 4860 (class 2604 OID 79438)
-- Name: detections id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detections ALTER COLUMN id SET DEFAULT nextval('public.detections_id_seq'::regclass);


--
-- TOC entry 4850 (class 2604 OID 79358)
-- Name: exam_sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_sessions ALTER COLUMN id SET DEFAULT nextval('public.exam_sessions_id_seq'::regclass);


--
-- TOC entry 4854 (class 2604 OID 79382)
-- Name: feeds id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feeds ALTER COLUMN id SET DEFAULT nextval('public.feeds_id_seq'::regclass);


--
-- TOC entry 4876 (class 2604 OID 79581)
-- Name: hardware_gateways id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hardware_gateways ALTER COLUMN id SET DEFAULT nextval('public.hardware_gateways_id_seq'::regclass);


--
-- TOC entry 4879 (class 2604 OID 79594)
-- Name: proctor_actions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proctor_actions ALTER COLUMN id SET DEFAULT nextval('public.proctor_actions_id_seq'::regclass);


--
-- TOC entry 4845 (class 2604 OID 79286)
-- Name: sections section_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sections ALTER COLUMN section_id SET DEFAULT nextval('public.sections_section_id_seq'::regclass);


--
-- TOC entry 4857 (class 2604 OID 79402)
-- Name: session_feeds id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_feeds ALTER COLUMN id SET DEFAULT nextval('public.session_feeds_id_seq'::regclass);


--
-- TOC entry 4862 (class 2604 OID 79488)
-- Name: signals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signals ALTER COLUMN id SET DEFAULT nextval('public.signals_id_seq'::regclass);


--
-- TOC entry 4849 (class 2604 OID 79332)
-- Name: student_sections id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_sections ALTER COLUMN id SET DEFAULT nextval('public.student_sections_id_seq'::regclass);


--
-- TOC entry 4847 (class 2604 OID 79310)
-- Name: students id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students ALTER COLUMN id SET DEFAULT nextval('public.students_id_seq'::regclass);


--
-- TOC entry 4865 (class 2604 OID 79549)
-- Name: subjects id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects ALTER COLUMN id SET DEFAULT nextval('public.subjects_id_seq'::regclass);


--
-- TOC entry 4861 (class 2604 OID 79464)
-- Name: video_segments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_segments ALTER COLUMN id SET DEFAULT nextval('public.video_segments_id_seq'::regclass);


--
-- TOC entry 5157 (class 0 OID 79622)
-- Dependencies: 250
-- Data for Name: camera_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.camera_links (id, seat_label, feed_id, camera_id, feed_label, status, linked_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5130 (class 0 OID 79271)
-- Dependencies: 219
-- Data for Name: courses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.courses (course_code, course_name, credits, created_at) FROM stdin;
CSE215	Data Structures	3	2026-04-20 11:03:30.94563+06
CSE225	Algorithms	3	2026-04-20 11:03:30.94563+06
CSE299	Junior Design Project	3	2026-04-20 11:03:30.94563+06
CSE300	Senior Design Project	3	2026-04-20 11:03:30.94563+06
CSE311	Database Systems	3	2026-04-20 11:03:30.94563+06
CSE331	Computer Networks	3	2026-04-20 11:03:30.94563+06
MAT361	Engineering Mathematics III	3	2026-04-20 11:03:30.94563+06
\.


--
-- TOC entry 5144 (class 0 OID 79435)
-- Dependencies: 233
-- Data for Name: detections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.detections (id, session_id, feed_id, detected_at, class_label, confidence, alert_clip_path, image_reference, notes) FROM stdin;
1	1	1	2026-04-17 11:21:30.94563+06	phone	0.92	\N	\N	\N
2	1	1	2026-04-17 11:37:30.94563+06	phone	0.88	\N	\N	Student warned verbally
3	1	1	2026-04-17 12:10:30.94563+06	phone	0.94	\N	\N	Second warning issued
4	1	1	2026-04-17 12:38:30.94563+06	phone	0.91	\N	\N	Repeated offence — reported
5	1	3	2026-04-17 11:25:30.94563+06	cheatsheet	0.76	\N	\N	\N
6	1	3	2026-04-17 11:58:30.94563+06	looking_away	0.71	\N	\N	\N
7	1	3	2026-04-17 12:21:30.94563+06	cheatsheet	0.83	\N	\N	Proctor moved closer
8	1	4	2026-04-17 11:44:30.94563+06	cheating	0.95	\N	\N	Appeared to copy from neighbour
9	1	4	2026-04-17 12:32:30.94563+06	cheating	0.87	\N	\N	Same behaviour repeated
10	1	4	2026-04-17 12:44:30.94563+06	phone	0.79	\N	\N	\N
11	1	2	2026-04-17 11:47:30.94563+06	looking_away	0.68	\N	\N	\N
12	1	5	2026-04-17 12:16:30.94563+06	phone	0.82	\N	\N	\N
13	1	5	2026-04-17 12:31:30.94563+06	looking_away	0.71	\N	\N	\N
14	1	2	2026-04-17 12:55:30.94563+06	cheatsheet	0.77	\N	\N	\N
15	4	2	2026-04-19 11:15:30.94563+06	phone	0.89	\N	\N	\N
16	4	2	2026-04-19 11:31:30.94563+06	phone	0.93	\N	\N	Warned
17	4	2	2026-04-19 11:44:30.94563+06	cheatsheet	0.78	\N	\N	\N
18	4	2	2026-04-19 11:56:30.94563+06	cheating	0.91	\N	\N	Confirmed cheating — disabled pen
19	4	3	2026-04-19 11:22:30.94563+06	looking_away	0.74	\N	\N	\N
20	4	3	2026-04-19 11:38:30.94563+06	phone	0.86	\N	\N	Second phone detection
21	4	3	2026-04-19 11:50:30.94563+06	cheatsheet	0.81	\N	\N	\N
22	4	3	2026-04-19 12:01:30.94563+06	cheating	0.88	\N	\N	Flagged for review
23	5	3	2026-04-15 11:13:30.94563+06	phone	0.84	\N	\N	\N
24	5	3	2026-04-15 11:28:30.94563+06	phone	0.91	\N	\N	Mock — no action taken
25	5	3	2026-04-15 11:43:30.94563+06	looking_away	0.69	\N	\N	\N
26	5	3	2026-04-15 11:58:30.94563+06	cheatsheet	0.75	\N	\N	\N
27	5	3	2026-04-15 12:05:30.94563+06	cheating	0.83	\N	\N	Noted for training purposes
28	5	1	2026-04-15 11:38:30.94563+06	looking_away	0.66	\N	\N	\N
29	5	4	2026-04-15 11:51:30.94563+06	phone	0.72	\N	\N	\N
30	5	4	2026-04-15 12:13:30.94563+06	looking_away	0.68	\N	\N	\N
\.


--
-- TOC entry 5138 (class 0 OID 79355)
-- Dependencies: 227
-- Data for Name: exam_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.exam_sessions (id, name, course_name, instructor_name, time_block, created_at, ended_at, duration_ms, status, exam_type, section_id, deleted_at) FROM stdin;
1	CSE299_Midterm_Spring2026	Junior Design Project	SvA	09:00 – 11:00	2026-04-17 11:03:30.94563+06	2026-04-17 13:03:30.94563+06	7200000	ended	midterm	1	\N
3	CSE311_Final_Spring2026	Database Systems	TaA	10:00 – 13:00	2026-04-10 11:03:30.94563+06	2026-04-10 14:03:30.94563+06	10800000	ended	final	6	\N
4	CSE331_Quiz2_Spring2026	Computer Networks	NkS	11:00 – 12:00	2026-04-19 11:03:30.94563+06	2026-04-19 12:03:30.94563+06	3600000	ended	quiz	8	\N
5	CSE299_Mock_Spring2026	Junior Design Project	SvA	14:00 – 15:30	2026-04-15 11:03:30.94563+06	2026-04-15 12:33:30.94563+06	5400000	ended	mock	1	\N
2	CSE300_Quiz1_Spring2026	Senior Design Project	JDP	14:00 – 15:00	2026-04-20 10:33:30.94563+06	2026-04-20 11:13:58.884884+06	3600000	active	quiz	4	\N
6	CSE311_MID_SUM22_2	Database Systems	TaA	09:00 - 11:00	2026-04-20 11:15:12.556756+06	2026-04-20 16:03:08.722166+06	\N	active	midterm	\N	\N
7	test	Junior Design Project	SvA	test	2026-04-20 16:04:10.67328+06	2026-04-20 21:52:47.105663+06	\N	active	midterm	\N	\N
8	test	Database Systems	test	test23	2026-04-21 00:27:17.48716+06	2026-04-25 06:26:52.72791+06	\N	active	midterm	\N	\N
9	Test	Junior Design Project	SvA	Apr 25, 2026, 11:10 AM	2026-04-25 11:03:48.241932+06	2026-04-25 11:03:57.050189+06	\N	active	midterm	\N	\N
10	e_g__Mid-term_Biology_101te	Senior Design Project	JDP	Apr 24, 2026, 11:10 AM	2026-04-25 11:05:50.229462+06	2026-04-25 16:11:48.618734+06	\N	active	midterm	\N	\N
11	test_exam_title_3	Computer Networks	NkS	Apr 25, 2026, 01:02 AM	2026-04-25 16:11:50.309942+06	2026-04-25 20:35:13.883979+06	\N	active	midterm	\N	\N
12	testing_camera	Junior Design Project	SvA	Apr 25, 2026, 01:02 PM	2026-04-25 20:35:14.177313+06	2026-04-26 06:49:29.25589+06	\N	active	midterm	\N	\N
13	cam	Junior Design Project	SvA	Apr 26, 2026, 01:02 AM	2026-04-26 06:49:29.262666+06	\N	\N	active	midterm	\N	\N
\.


--
-- TOC entry 5140 (class 0 OID 79379)
-- Dependencies: 229
-- Data for Name: feeds; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.feeds (id, label, client_id, connected, camera_id, created_at, deleted_at) FROM stdin;
6	Seat 02 MARS 2222	127.0.0.1_Seat 02 MARS 2222	f	CAM-GNA3	2026-04-20 11:12:47.7372+06	2026-04-26 08:17:02.387611+06
1	Seat 01	192.168.43.101_Seat 01	f	CAM-A1B2	2026-04-20 11:03:30.94563+06	2026-04-20 11:15:12.544328+06
2	Seat 02	192.168.43.102_Seat 02	f	CAM-C3D4	2026-04-20 11:03:30.94563+06	2026-04-20 11:15:12.544328+06
3	Seat 03	192.168.43.103_Seat 03	f	CAM-E5F6	2026-04-20 11:03:30.94563+06	2026-04-20 11:15:12.544328+06
4	Seat 04	192.168.43.104_Seat 04	f	CAM-G7H8	2026-04-20 11:03:30.94563+06	2026-04-20 11:15:12.544328+06
5	Seat 05	192.168.43.105_Seat 05	f	CAM-I9J0	2026-04-20 11:03:30.94563+06	2026-04-20 11:15:12.544328+06
8	Seat 25	127.0.0.1_Seat 25	f	CAM-JJJW	2026-04-26 08:00:08.120787+06	\N
7	Seat 01	127.0.0.1_Seat 01	f	CAM-TGC2	2026-04-20 15:33:02.981733+06	\N
\.


--
-- TOC entry 5153 (class 0 OID 79578)
-- Dependencies: 245
-- Data for Name: hardware_gateways; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.hardware_gateways (id, label, ip_address, last_seen, status) FROM stdin;
\.


--
-- TOC entry 5155 (class 0 OID 79591)
-- Dependencies: 247
-- Data for Name: proctor_actions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.proctor_actions (id, session_id, action_type, details, created_at) FROM stdin;
\.


--
-- TOC entry 5132 (class 0 OID 79283)
-- Dependencies: 221
-- Data for Name: sections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sections (section_id, course_code, section_name, initials, year, year_session) FROM stdin;
1	CSE299	06	SvA	2026	Spring
2	CSE299	07	RaH	2026	Spring
3	CSE299	08	MsR	2026	Spring
4	CSE300	04	JDP	2026	Spring
5	CSE300	05	KhM	2026	Spring
6	CSE311	01	TaA	2026	Spring
7	CSE311	02	FaB	2026	Spring
8	CSE331	03	NkS	2026	Spring
9	CSE215	01	SvA	2026	Summer
10	CSE215	02	RaH	2026	Summer
11	CSE225	01	MsR	2026	Summer
12	MAT361	05	FaB	2026	Spring
\.


--
-- TOC entry 5142 (class 0 OID 79399)
-- Dependencies: 231
-- Data for Name: session_feeds; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.session_feeds (id, session_id, feed_id, feed_label, candidate_name, connected_at, student_id, time_remaining_ms, student_status) FROM stdin;
3	1	3	Seat 03	Rafi Islam	2026-04-17 11:04:30.94563+06	3	0	flagged
4	1	4	Seat 04	Nadia Akter	2026-04-17 11:07:30.94563+06	4	0	submitted
5	1	5	Seat 05	Shibli Sadik	2026-04-17 11:05:30.94563+06	5	0	submitted
6	2	1	Seat 01	Lamia Chowdhury	2026-04-20 10:34:30.94563+06	6	1800000	present
7	2	2	Seat 02	Tanvir Hasan	2026-04-20 10:35:30.94563+06	7	1800000	present
8	2	3	Seat 03	Sadia Islam	2026-04-20 10:34:30.94563+06	8	1800000	paused
9	2	4	Seat 04	Mehrab Hossain	2026-04-20 10:36:30.94563+06	9	1800000	present
10	2	5	Seat 05	\N	2026-04-20 10:33:30.94563+06	\N	0	absent
11	3	1	Seat 01	Ishrak Ahmed	2026-04-10 11:05:30.94563+06	11	0	submitted
12	3	2	Seat 02	Sabrina Kabir	2026-04-10 11:04:30.94563+06	12	0	submitted
13	3	3	Seat 03	Raquibul Hasan	2026-04-10 11:08:30.94563+06	13	0	submitted
14	3	4	Seat 04	Samia Rahman	2026-04-10 11:05:30.94563+06	14	0	submitted
15	4	1	Seat 01	Zarif Chowdhury	2026-04-19 11:04:30.94563+06	16	0	submitted
16	4	2	Seat 02	Momo Akter	2026-04-19 11:05:30.94563+06	17	0	flagged
17	4	3	Seat 03	Tahmid Islam	2026-04-19 11:04:30.94563+06	18	0	flagged
18	4	4	Seat 04	Nusrat Jahan	2026-04-19 11:06:30.94563+06	19	0	submitted
19	4	5	Seat 05	Rezwan Ul Karim	2026-04-19 11:05:30.94563+06	20	0	submitted
20	5	1	Seat 01	Ahmed Rahman	2026-04-15 11:04:30.94563+06	1	0	submitted
21	5	2	Seat 02	Tasnim Hossain	2026-04-15 11:05:30.94563+06	2	0	submitted
22	5	3	Seat 03	Rafi Islam	2026-04-15 11:04:30.94563+06	3	0	flagged
23	5	4	Seat 04	Nadia Akter	2026-04-15 11:06:30.94563+06	4	0	submitted
24	5	5	Seat 05	Shibli Sadik	2026-04-15 11:05:30.94563+06	5	0	submitted
25	2	6	Seat 02 MARS 2222	\N	2026-04-20 11:12:47.747754+06	\N	\N	present
26	6	7	Seat 01	\N	2026-04-20 15:33:04.65055+06	\N	\N	present
29	6	6	Seat 02 MARS 2222	\N	2026-04-20 15:51:51.759098+06	\N	\N	present
34	7	6	Seat 02 MARS 2222	\N	2026-04-20 16:04:30.991432+06	\N	\N	present
36	7	7	Seat 01	\N	2026-04-20 16:06:39.743705+06	\N	\N	present
38	8	6	Seat 02 MARS 2222	\N	2026-04-21 09:27:38.391556+06	\N	\N	present
39	8	7	Seat 01	\N	2026-04-21 10:02:20.646107+06	\N	\N	present
1	1	1	Seat 01	Ahmed Rahman	2026-04-17 11:05:30.94563+06	1	0	submitted
2	1	2	Seat 02	Tasnim Hossain	2026-04-17 11:06:30.94563+06	2	0	submitted
42	10	7	Seat 01	\N	2026-04-25 11:25:22.255933+06	\N	\N	present
45	11	7	Seat 01	\N	2026-04-25 16:48:31.241619+06	\N	\N	present
47	12	7	Seat 01	\N	2026-04-25 20:35:46.975552+06	\N	\N	present
54	13	7	Seat 01	\N	2026-04-26 07:00:46.476267+06	\N	\N	present
59	13	6	Seat 02 MARS 2222	\N	2026-04-26 07:34:28.868836+06	\N	\N	present
61	13	8	Seat 25	\N	2026-04-26 08:00:08.289045+06	\N	\N	present
\.


--
-- TOC entry 5148 (class 0 OID 79485)
-- Dependencies: 237
-- Data for Name: signals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.signals (id, session_id, feed_id, signal, params, sent_at, sent_by, action_type, invigilator_id) FROM stdin;
1	1	\N	timer	{"cmd": "timer", "duration_ms": 7200000}	2026-04-17 11:01:30.94563+06	admin	exam_control	admin
2	1	\N	start	{"cmd": "start"}	2026-04-17 11:03:30.94563+06	admin	exam_control	admin
3	1	1	warn	{"cmd": "warn", "device_id": 1}	2026-04-17 11:22:30.94563+06	admin	unit_control	admin
4	1	3	warn	{"cmd": "warn", "device_id": 3}	2026-04-17 11:26:30.94563+06	admin	unit_control	admin
5	1	\N	pause	{"cmd": "pause"}	2026-04-17 12:03:30.94563+06	admin	exam_control	admin
6	1	\N	start	{"cmd": "start"}	2026-04-17 12:08:30.94563+06	admin	exam_control	admin
7	1	4	disable	{"cmd": "disable", "device_id": 4, "punish_ms": 300000}	2026-04-17 11:45:30.94563+06	admin	unit_control	admin
8	1	1	warn	{"cmd": "warn", "device_id": 1}	2026-04-17 12:11:30.94563+06	admin	unit_control	admin
9	1	1	deduct	{"cmd": "deduct", "time_ms": 300000, "device_id": 1}	2026-04-17 12:13:30.94563+06	admin	unit_control	admin
10	1	\N	reset	{"cmd": "reset", "transport": "ble"}	2026-04-17 12:07:30.94563+06	pen_app	exam_control	pen_app
11	1	3	disable	{"cmd": "disable", "device_id": 3, "punish_ms": 120000}	2026-04-17 12:22:30.94563+06	admin	unit_control	admin
12	1	3	enable	{"cmd": "enable", "device_id": 3}	2026-04-17 12:24:30.94563+06	admin	unit_control	admin
13	1	4	enable	{"cmd": "enable", "device_id": 4}	2026-04-17 12:38:30.94563+06	admin	unit_control	admin
14	1	\N	end	{"cmd": "end"}	2026-04-17 13:03:30.94563+06	admin	exam_control	admin
15	2	\N	timer	{"cmd": "timer", "duration_ms": 3600000}	2026-04-20 10:32:30.94563+06	admin	exam_control	admin
16	2	\N	start	{"cmd": "start"}	2026-04-20 10:33:30.94563+06	admin	exam_control	admin
17	2	3	disable	{"cmd": "disable", "device_id": 3}	2026-04-20 10:48:30.94563+06	admin	unit_control	admin
18	2	3	enable	{"cmd": "enable", "device_id": 3}	2026-04-20 10:55:30.94563+06	admin	unit_control	admin
19	2	\N	reset	{"cmd": "reset", "transport": "ble"}	2026-04-20 10:38:30.94563+06	pen_app	exam_control	pen_app
20	2	1	warn	{"cmd": "warn", "device_id": 1}	2026-04-20 10:51:30.94563+06	pen_app	unit_control	pen_app
21	2	\N	pause	{"cmd": "pause"}	2026-04-20 11:01:30.94563+06	admin	exam_control	admin
22	2	\N	start	{"cmd": "start"}	2026-04-20 11:03:30.94563+06	admin	exam_control	admin
23	3	\N	timer	{"cmd": "timer", "duration_ms": 10800000}	2026-04-10 11:00:30.94563+06	admin	exam_control	admin
24	3	\N	start	{"cmd": "start"}	2026-04-10 11:03:30.94563+06	admin	exam_control	admin
25	3	\N	pause	{"cmd": "pause"}	2026-04-10 12:33:30.94563+06	admin	exam_control	admin
26	3	\N	start	{"cmd": "start"}	2026-04-10 12:38:30.94563+06	admin	exam_control	admin
27	3	\N	end	{"cmd": "end"}	2026-04-10 14:03:30.94563+06	admin	exam_control	admin
28	3	\N	reset	{"cmd": "reset", "transport": "usb"}	2026-04-10 14:05:30.94563+06	admin	exam_control	admin
29	4	\N	timer	{"cmd": "timer", "duration_ms": 3600000}	2026-04-19 11:01:30.94563+06	admin	exam_control	admin
30	4	\N	start	{"cmd": "start"}	2026-04-19 11:03:30.94563+06	admin	exam_control	admin
31	4	2	warn	{"cmd": "warn", "device_id": 2}	2026-04-19 11:16:30.94563+06	admin	unit_control	admin
32	4	3	warn	{"cmd": "warn", "device_id": 3}	2026-04-19 11:23:30.94563+06	admin	unit_control	admin
33	4	2	disable	{"cmd": "disable", "device_id": 2, "punish_ms": 180000}	2026-04-19 11:57:30.94563+06	admin	unit_control	admin
34	4	3	disable	{"cmd": "disable", "device_id": 3, "punish_ms": 180000}	2026-04-19 12:02:30.94563+06	admin	unit_control	admin
35	4	2	deduct	{"cmd": "deduct", "time_ms": 600000, "device_id": 2}	2026-04-19 11:58:30.94563+06	admin	unit_control	admin
36	4	3	deduct	{"cmd": "deduct", "time_ms": 600000, "device_id": 3}	2026-04-19 12:03:30.94563+06	admin	unit_control	admin
37	4	\N	pause	{"cmd": "pause"}	2026-04-19 11:33:30.94563+06	admin	exam_control	admin
38	4	\N	end	{"cmd": "end"}	2026-04-19 12:03:30.94563+06	admin	exam_control	admin
39	5	\N	timer	{"cmd": "timer", "duration_ms": 5400000}	2026-04-15 11:02:30.94563+06	pen_app	exam_control	pen_app
40	5	\N	start	{"cmd": "start"}	2026-04-15 11:03:30.94563+06	pen_app	exam_control	pen_app
41	5	3	warn	{"cmd": "warn", "device_id": 3}	2026-04-15 11:29:30.94563+06	admin	unit_control	admin
42	5	\N	pause	{"cmd": "pause"}	2026-04-15 11:48:30.94563+06	pen_app	exam_control	pen_app
43	5	\N	start	{"cmd": "start"}	2026-04-15 11:50:30.94563+06	pen_app	exam_control	pen_app
44	5	\N	end	{"cmd": "end"}	2026-04-15 12:33:30.94563+06	pen_app	exam_control	pen_app
45	2	\N	timer	{"cmd": "timer", "duration_ms": 5400000}	2026-04-20 11:13:12.242591+06	admin	exam_control	\N
46	2	\N	start	{"cmd": "start"}	2026-04-20 11:13:18.569129+06	admin	exam_control	\N
47	2	\N	pause	{"cmd": "pause"}	2026-04-20 11:13:26.465134+06	admin	exam_control	\N
48	2	\N	end	{"cmd": "end"}	2026-04-20 11:13:58.775913+06	admin	exam_control	\N
49	6	\N	end	{"cmd": "end"}	2026-04-20 16:03:08.724637+06	admin	exam_control	\N
50	7	\N	end	{"cmd": "end"}	2026-04-20 21:52:45.286207+06	admin	exam_control	\N
\.


--
-- TOC entry 5136 (class 0 OID 79329)
-- Dependencies: 225
-- Data for Name: student_sections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.student_sections (id, std_id, section_id) FROM stdin;
1	2212345678	1
2	2212345679	1
3	2212345680	1
4	2212345681	1
5	2212345682	1
6	2212345683	4
7	2212345684	4
8	2212345685	4
9	2212345686	4
10	2212345687	4
11	2212345688	6
12	2212345689	6
13	2212345690	6
14	2212345691	6
15	2212345692	6
16	2212345693	8
17	2212345694	8
18	2212345695	8
19	2212345696	8
20	2212345697	8
21	2212345678	12
22	2212345683	12
23	2212345688	12
\.


--
-- TOC entry 5134 (class 0 OID 79307)
-- Dependencies: 223
-- Data for Name: students; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.students (id, name, student_id, email, section_id, seat_number, pen_unit_id, client_id, created_at, deleted_at) FROM stdin;
1	Ahmed Rahman	2212345678	ahmed.rahman@northsouth.edu	1	1	1	\N	2026-04-20 11:03:30.94563+06	\N
2	Tasnim Hossain	2212345679	tasnim.hossain@northsouth.edu	1	2	2	\N	2026-04-20 11:03:30.94563+06	\N
3	Rafi Islam	2212345680	rafi.islam@northsouth.edu	1	3	3	\N	2026-04-20 11:03:30.94563+06	\N
4	Nadia Akter	2212345681	nadia.akter@northsouth.edu	1	4	4	\N	2026-04-20 11:03:30.94563+06	\N
5	Shibli Sadik	2212345682	shibli.sadik@northsouth.edu	1	5	5	\N	2026-04-20 11:03:30.94563+06	\N
6	Lamia Chowdhury	2212345683	lamia.chowdhury@northsouth.edu	4	6	6	\N	2026-04-20 11:03:30.94563+06	\N
7	Tanvir Hasan	2212345684	tanvir.hasan@northsouth.edu	4	7	7	\N	2026-04-20 11:03:30.94563+06	\N
8	Sadia Islam	2212345685	sadia.islam@northsouth.edu	4	8	8	\N	2026-04-20 11:03:30.94563+06	\N
9	Mehrab Hossain	2212345686	mehrab.hossain@northsouth.edu	4	9	9	\N	2026-04-20 11:03:30.94563+06	\N
10	Fariha Noor	2212345687	fariha.noor@northsouth.edu	4	10	10	\N	2026-04-20 11:03:30.94563+06	\N
11	Ishrak Ahmed	2212345688	ishrak.ahmed@northsouth.edu	6	11	11	\N	2026-04-20 11:03:30.94563+06	\N
12	Sabrina Kabir	2212345689	sabrina.kabir@northsouth.edu	6	12	12	\N	2026-04-20 11:03:30.94563+06	\N
13	Raquibul Hasan	2212345690	raquibul.hasan@northsouth.edu	6	13	13	\N	2026-04-20 11:03:30.94563+06	\N
14	Samia Rahman	2212345691	samia.rahman@northsouth.edu	6	14	14	\N	2026-04-20 11:03:30.94563+06	\N
15	Nafis Ul Haque	2212345692	nafis.haque@northsouth.edu	6	15	15	\N	2026-04-20 11:03:30.94563+06	\N
16	Zarif Chowdhury	2212345693	zarif.chowdhury@northsouth.edu	8	16	16	\N	2026-04-20 11:03:30.94563+06	\N
17	Momo Akter	2212345694	momo.akter@northsouth.edu	8	17	17	\N	2026-04-20 11:03:30.94563+06	\N
18	Tahmid Islam	2212345695	tahmid.islam@northsouth.edu	8	18	18	\N	2026-04-20 11:03:30.94563+06	\N
19	Nusrat Jahan	2212345696	nusrat.jahan@northsouth.edu	8	19	19	\N	2026-04-20 11:03:30.94563+06	\N
20	Rezwan Ul Karim	2212345697	rezwan.karim@northsouth.edu	8	20	20	\N	2026-04-20 11:03:30.94563+06	\N
\.


--
-- TOC entry 5150 (class 0 OID 79546)
-- Dependencies: 242
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subjects (id, name, deleted_at, created_at) FROM stdin;
1	Database Systems (CSE311)	\N	2026-04-21 07:28:08.617669+06
2	Operating Systems (CSE323)	\N	2026-04-21 07:28:08.617669+06
3	Junior Design (CSE299)	\N	2026-04-21 07:28:08.617669+06
\.


--
-- TOC entry 5151 (class 0 OID 79559)
-- Dependencies: 243
-- Data for Name: user_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_settings (user_id, theme, language, font_scale, movement_threshold, audio_sensitivity, backend_api_url, ai_service_url, hardware_gateway_id, last_notification_read_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5146 (class 0 OID 79461)
-- Dependencies: 235
-- Data for Name: video_segments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.video_segments (id, session_id, feed_id, file_path, started_at, ended_at, size_bytes) FROM stdin;
1	1	1	recordings/CSE299_Midterm_Spring2026/Seat_01/Seat_01_seg_0000_2026-04-13_09-00.mp4	2026-04-17 11:03:30.94563+06	2026-04-17 11:13:30.94563+06	158000000
2	1	1	recordings/CSE299_Midterm_Spring2026/Seat_01/Seat_01_seg_0001_2026-04-13_09-10.mp4	2026-04-17 11:13:30.94563+06	2026-04-17 11:23:30.94563+06	161000000
3	1	2	recordings/CSE299_Midterm_Spring2026/Seat_02/Seat_02_seg_0000_2026-04-13_09-00.mp4	2026-04-17 11:03:30.94563+06	2026-04-17 11:13:30.94563+06	155000000
4	1	2	recordings/CSE299_Midterm_Spring2026/Seat_02/Seat_02_seg_0001_2026-04-13_09-10.mp4	2026-04-17 11:13:30.94563+06	2026-04-17 11:23:30.94563+06	157000000
5	1	3	recordings/CSE299_Midterm_Spring2026/Seat_03/Seat_03_seg_0000_2026-04-13_09-00.mp4	2026-04-17 11:03:30.94563+06	2026-04-17 11:13:30.94563+06	162000000
6	1	3	recordings/CSE299_Midterm_Spring2026/Seat_03/Seat_03_seg_0001_2026-04-13_09-10.mp4	2026-04-17 11:13:30.94563+06	2026-04-17 11:23:30.94563+06	159000000
7	1	4	recordings/CSE299_Midterm_Spring2026/Seat_04/Seat_04_seg_0000_2026-04-13_09-00.mp4	2026-04-17 11:03:30.94563+06	2026-04-17 11:13:30.94563+06	160000000
8	1	4	recordings/CSE299_Midterm_Spring2026/Seat_04/Seat_04_seg_0001_2026-04-13_09-10.mp4	2026-04-17 11:13:30.94563+06	2026-04-17 11:23:30.94563+06	163000000
9	4	1	recordings/CSE331_Quiz2_Spring2026/Seat_01/Seat_01_seg_0000_2026-04-19_11-00.mp4	2026-04-19 11:03:30.94563+06	2026-04-19 11:13:30.94563+06	98000000
10	4	1	recordings/CSE331_Quiz2_Spring2026/Seat_01/Seat_01_seg_0001_2026-04-19_11-10.mp4	2026-04-19 11:13:30.94563+06	2026-04-19 11:23:30.94563+06	99000000
11	4	2	recordings/CSE331_Quiz2_Spring2026/Seat_02/Seat_02_seg_0000_2026-04-19_11-00.mp4	2026-04-19 11:03:30.94563+06	2026-04-19 11:13:30.94563+06	101000000
12	4	2	recordings/CSE331_Quiz2_Spring2026/Seat_02/Seat_02_seg_0001_2026-04-19_11-10.mp4	2026-04-19 11:13:30.94563+06	2026-04-19 11:23:30.94563+06	103000000
13	4	3	recordings/CSE331_Quiz2_Spring2026/Seat_03/Seat_03_seg_0000_2026-04-19_11-00.mp4	2026-04-19 11:03:30.94563+06	2026-04-19 11:13:30.94563+06	97000000
14	4	3	recordings/CSE331_Quiz2_Spring2026/Seat_03/Seat_03_seg_0001_2026-04-19_11-10.mp4	2026-04-19 11:13:30.94563+06	2026-04-19 11:23:30.94563+06	100000000
15	4	4	recordings/CSE331_Quiz2_Spring2026/Seat_04/Seat_04_seg_0000_2026-04-19_11-00.mp4	2026-04-19 11:03:30.94563+06	2026-04-19 11:13:30.94563+06	96000000
16	4	4	recordings/CSE331_Quiz2_Spring2026/Seat_04/Seat_04_seg_0001_2026-04-19_11-10.mp4	2026-04-19 11:13:30.94563+06	2026-04-19 11:23:30.94563+06	98000000
17	5	1	recordings/CSE299_Mock_Spring2026/Seat_01/Seat_01_seg_0000_2026-04-15_14-00.mp4	2026-04-15 11:03:30.94563+06	2026-04-15 11:13:30.94563+06	87000000
18	5	1	recordings/CSE299_Mock_Spring2026/Seat_01/Seat_01_seg_0001_2026-04-15_14-10.mp4	2026-04-15 11:13:30.94563+06	2026-04-15 11:23:30.94563+06	89000000
19	5	2	recordings/CSE299_Mock_Spring2026/Seat_02/Seat_02_seg_0000_2026-04-15_14-00.mp4	2026-04-15 11:03:30.94563+06	2026-04-15 11:13:30.94563+06	85000000
20	5	2	recordings/CSE299_Mock_Spring2026/Seat_02/Seat_02_seg_0001_2026-04-15_14-10.mp4	2026-04-15 11:13:30.94563+06	2026-04-15 11:23:30.94563+06	88000000
21	2	6	recordings\\CSE300_Quiz1_Spring2026\\Seat_02_MARS_2222\\Seat_02_MARS_2222_seg_0000_2026-04-20_11-12-47.mp4	2026-04-20 11:12:49.251869+06	2026-04-20 11:12:56.389384+06	48
22	6	7	recordings\\CSE311_MID_SUM22_2\\Seat_01\\Seat_01_seg_0000_2026-04-20_15-33-04.mp4	2026-04-20 15:33:04.715071+06	2026-04-20 15:41:24.19535+06	3145776
23	6	7	recordings\\CSE311_MID_SUM22_2\\Seat_01\\Seat_01_seg_0000_2026-04-20_15-42-50.mp4	2026-04-20 15:42:50.804808+06	2026-04-20 15:43:31.137452+06	2621488
24	6	7	recordings\\CSE311_MID_SUM22_2\\Seat_01\\Seat_01_seg_0000_2026-04-20_15-43-41.mp4	2026-04-20 15:43:41.339767+06	2026-04-20 15:46:20.991078+06	1310768
25	6	6	recordings\\CSE311_MID_SUM22_2\\Seat_02_MARS_2222\\Seat_02_MARS_2222_seg_0000_2026-04-20_15-51-51.mp4	2026-04-20 15:51:51.791765+06	2026-04-20 15:51:56.750296+06	0
26	6	6	recordings\\CSE311_MID_SUM22_2\\Seat_02_MARS_2222\\Seat_02_MARS_2222_seg_0000_2026-04-20_15-52-41.mp4	2026-04-20 15:52:41.40276+06	2026-04-20 15:53:59.236697+06	524336
27	6	6	recordings\\CSE311_MID_SUM22_2\\Seat_02_MARS_2222\\Seat_02_MARS_2222_seg_0000_2026-04-20_15-59-24.mp4	2026-04-20 15:59:25.86621+06	2026-04-20 15:59:26.036719+06	0
28	6	6	recordings\\CSE311_MID_SUM22_2\\Seat_02_MARS_2222\\Seat_02_MARS_2222_seg_0000_2026-04-20_15-59-37.mp4	2026-04-20 15:59:37.074892+06	2026-04-20 16:00:19.93443+06	1310768
29	6	6	recordings\\CSE311_MID_SUM22_2\\Seat_02_MARS_2222\\Seat_02_MARS_2222_seg_0000_2026-04-20_16-01-17.mp4	2026-04-20 16:01:17.702921+06	2026-04-20 16:01:57.146862+06	1310768
30	\N	7	recordings\\2026-04-20_16-03-45\\Seat_01\\Seat_01_seg_0000_2026-04-20_16-03-45.mp4	2026-04-20 16:03:45.65219+06	2026-04-20 16:03:51.392216+06	48
31	7	6	recordings\\test\\Seat_02_MARS_2222\\Seat_02_MARS_2222_seg_0000_2026-04-20_16-04-30.mp4	2026-04-20 16:04:31.01182+06	2026-04-20 16:04:34.718553+06	0
32	7	6	recordings\\test\\Seat_02_MARS_2222\\Seat_02_MARS_2222_seg_0000_2026-04-20_16-04-45.mp4	2026-04-20 16:04:45.61709+06	2026-04-20 16:04:51.078528+06	48
33	7	7	recordings\\test\\Seat_01\\Seat_01_seg_0000_2026-04-20_16-06-39.mp4	2026-04-20 16:06:39.78434+06	2026-04-20 16:07:19.978271+06	262192
34	7	7	recordings\\test\\Seat_01\\Seat_01_seg_0000_2026-04-20_21-44-35.mp4	2026-04-20 21:44:36.679884+06	2026-04-20 21:45:17.952067+06	786480
36	\N	6	recordings\\2026-04-20_22-00-18\\Seat_02_MARS_2222\\Seat_02_MARS_2222_seg_0000_2026-04-20_22-00-18.mp4	2026-04-20 22:00:18.564019+06	2026-04-20 22:00:27.074942+06	262192
35	\N	7	recordings\\2026-04-20_22-00-11\\Seat_01\\Seat_01_seg_0000_2026-04-20_22-00-11.mp4	2026-04-20 22:00:11.769464+06	2026-04-20 22:00:28.097645+06	262192
37	\N	7	recordings\\2026-04-21_00-24-16\\Seat_01\\Seat_01_seg_0000_2026-04-21_00-24-16.mp4	2026-04-21 00:24:16.253141+06	2026-04-21 00:34:16.253814+06	9175088
38	\N	7	recordings\\2026-04-21_00-24-16\\Seat_01\\Seat_01_seg_0001_2026-04-21_00-34-16.mp4	2026-04-21 00:34:16.580031+06	2026-04-21 00:41:45.21178+06	4194352
39	8	6	recordings\\test\\Seat_02_MARS_2222\\Seat_02_MARS_2222_seg_0000_2026-04-21_09-27-38.mp4	2026-04-21 09:27:38.646444+06	2026-04-21 09:27:38.951725+06	0
40	8	7	recordings\\test\\Seat_01\\Seat_01_seg_0000_2026-04-21_10-02-20.mp4	2026-04-21 10:02:20.686483+06	2026-04-21 10:03:02.519216+06	3932208
41	8	7	recordings\\test\\Seat_01\\Seat_01_seg_0000_2026-04-21_10-03-09.mp4	2026-04-21 10:03:09.052641+06	2026-04-21 10:03:15.633457+06	262192
42	8	7	recordings\\test\\Seat_01\\Seat_01_seg_0000_2026-04-24_12-24-45.mp4	2026-04-24 12:24:46.504197+06	2026-04-24 12:24:53.724081+06	48
43	10	7	recordings\\e_g__Mid-term_Biology_101te\\Seat_01\\Seat_01_seg_0000_2026-04-25_11-25-22.mp4	2026-04-25 11:25:24.112438+06	2026-04-25 11:25:26.807028+06	0
44	10	7	recordings\\e_g__Mid-term_Biology_101te\\Seat_01\\Seat_01_seg_0000_2026-04-25_11-31-08.mp4	2026-04-25 11:31:08.105763+06	2026-04-25 11:31:11.606417+06	0
45	10	7	recordings\\e_g__Mid-term_Biology_101te\\Seat_01\\Seat_01_seg_0000_2026-04-25_11-57-16.mp4	2026-04-25 11:57:18.00194+06	2026-04-25 11:58:10.400842+06	48
46	11	7	recordings\\test_exam_title_3\\Seat_01\\Seat_01_seg_0000_2026-04-25_16-48-31.mp4	2026-04-25 16:48:33.222312+06	2026-04-25 16:48:37.498097+06	48
47	11	7	recordings\\test_exam_title_3\\Seat_01\\Seat_01_seg_0000_2026-04-25_16-48-51.mp4	2026-04-25 16:48:51.098809+06	2026-04-25 16:49:39.8112+06	48
48	12	7	recordings\\testing_camera\\Seat_01\\Seat_01_seg_0000_2026-04-25_20-35-47.mp4	2026-04-25 20:35:48.589449+06	2026-04-25 20:35:54.856137+06	262192
49	12	7	recordings\\testing_camera\\Seat_01\\Seat_01_seg_0000_2026-04-25_20-36-05.mp4	2026-04-25 20:36:05.706191+06	2026-04-25 20:39:09.018363+06	2097200
50	12	7	recordings\\testing_camera\\Seat_01\\Seat_01_seg_0000_2026-04-25_20-42-29.mp4	2026-04-25 20:42:30.015649+06	2026-04-25 20:42:54.649171+06	524336
51	12	7	recordings\\testing_camera\\Seat_01\\Seat_01_seg_0000_2026-04-25_21-12-59.mp4	2026-04-25 21:12:59.685045+06	2026-04-25 21:13:10.509428+06	524336
52	12	7	recordings\\testing_camera\\Seat_01\\Seat_01_seg_0000_2026-04-25_21-32-12.mp4	2026-04-25 21:32:12.997808+06	2026-04-25 21:32:50.88118+06	262192
53	12	7	recordings\\testing_camera\\Seat_01\\Seat_01_seg_0000_2026-04-26_06-45-24.mp4	2026-04-26 06:45:26.351995+06	\N	\N
54	12	7	recordings\\testing_camera\\Seat_01\\Seat_01_seg_0000_2026-04-26_06-48-41.mp4	2026-04-26 06:48:42.420551+06	2026-04-26 06:50:57.968055+06	1835056
55	13	7	recordings\\cam\\Seat_01\\Seat_01_seg_0000_2026-04-26_07-00-46.mp4	2026-04-26 07:00:46.65811+06	2026-04-26 07:01:11.631305+06	0
56	13	7	recordings\\cam\\Seat_01\\Seat_01_seg_0000_2026-04-26_07-06-34.mp4	2026-04-26 07:06:34.225687+06	2026-04-26 07:07:16.881552+06	262192
57	13	7	recordings\\cam\\Seat_01\\Seat_01_seg_0000_2026-04-26_07-10-08.mp4	2026-04-26 07:10:08.806577+06	2026-04-26 07:10:47.839298+06	262192
58	13	7	recordings\\cam\\Seat_01\\Seat_01_seg_0000_2026-04-26_07-27-01.mp4	2026-04-26 07:27:01.208382+06	2026-04-26 07:27:34.213999+06	48
59	13	7	recordings\\cam\\Seat_01\\Seat_01_seg_0000_2026-04-26_07-29-22.mp4	2026-04-26 07:29:22.031026+06	2026-04-26 07:29:45.439729+06	0
60	13	6	recordings\\cam\\Seat_02_MARS_2222\\Seat_02_MARS_2222_seg_0000_2026-04-26_07-34-28.mp4	2026-04-26 07:34:28.905612+06	2026-04-26 07:35:51.776745+06	1048624
61	13	6	recordings\\cam\\Seat_02_MARS_2222\\Seat_02_MARS_2222_seg_0000_2026-04-26_07-58-55.mp4	2026-04-26 07:58:55.94656+06	2026-04-26 07:59:48.446259+06	786480
62	13	8	recordings\\cam\\Seat_25\\Seat_25_seg_0000_2026-04-26_08-00-08.mp4	2026-04-26 08:00:08.318867+06	2026-04-26 08:00:56.974443+06	1048624
63	13	8	recordings\\cam\\Seat_25\\Seat_25_seg_0000_2026-04-26_08-02-36.mp4	2026-04-26 08:02:36.509995+06	2026-04-26 08:03:16.983435+06	524336
64	13	8	recordings\\cam\\Seat_25\\Seat_25_seg_0000_2026-04-26_08-12-54.mp4	2026-04-26 08:12:54.385174+06	2026-04-26 08:16:55.644964+06	4718640
65	13	7	recordings\\cam\\Seat_01\\Seat_01_seg_0000_2026-04-26_08-16-11.mp4	2026-04-26 08:16:11.559178+06	2026-04-26 08:16:57.008904+06	262192
66	13	8	recordings\\cam\\Seat_25\\Seat_25_seg_0000_2026-04-26_11-57-08.mp4	2026-04-26 11:57:10.179021+06	2026-04-26 12:01:20.341+06	2621488
67	13	8	recordings\\cam\\Seat_25\\Seat_25_seg_0000_2026-04-26_12-03-47.mp4	2026-04-26 12:03:47.450314+06	2026-04-26 12:03:54.159374+06	0
68	13	8	recordings\\cam\\Seat_25\\Seat_25_seg_0000_2026-04-26_12-04-22.mp4	2026-04-26 12:04:22.2007+06	2026-04-26 12:05:48.174836+06	48
69	13	7	recordings\\cam\\Seat_01\\Seat_01_seg_0000_2026-04-26_12-05-15.mp4	2026-04-26 12:05:15.363322+06	2026-04-26 12:05:49.072255+06	0
\.


--
-- TOC entry 5176 (class 0 OID 0)
-- Dependencies: 249
-- Name: camera_links_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.camera_links_id_seq', 1, false);


--
-- TOC entry 5177 (class 0 OID 0)
-- Dependencies: 232
-- Name: detections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.detections_id_seq', 30, true);


--
-- TOC entry 5178 (class 0 OID 0)
-- Dependencies: 226
-- Name: exam_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.exam_sessions_id_seq', 13, true);


--
-- TOC entry 5179 (class 0 OID 0)
-- Dependencies: 228
-- Name: feeds_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.feeds_id_seq', 8, true);


--
-- TOC entry 5180 (class 0 OID 0)
-- Dependencies: 244
-- Name: hardware_gateways_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.hardware_gateways_id_seq', 1, false);


--
-- TOC entry 5181 (class 0 OID 0)
-- Dependencies: 246
-- Name: proctor_actions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.proctor_actions_id_seq', 1, false);


--
-- TOC entry 5182 (class 0 OID 0)
-- Dependencies: 220
-- Name: sections_section_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sections_section_id_seq', 12, true);


--
-- TOC entry 5183 (class 0 OID 0)
-- Dependencies: 230
-- Name: session_feeds_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.session_feeds_id_seq', 68, true);


--
-- TOC entry 5184 (class 0 OID 0)
-- Dependencies: 236
-- Name: signals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.signals_id_seq', 50, true);


--
-- TOC entry 5185 (class 0 OID 0)
-- Dependencies: 224
-- Name: student_sections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.student_sections_id_seq', 23, true);


--
-- TOC entry 5186 (class 0 OID 0)
-- Dependencies: 222
-- Name: students_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.students_id_seq', 20, true);


--
-- TOC entry 5187 (class 0 OID 0)
-- Dependencies: 241
-- Name: subjects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subjects_id_seq', 3, true);


--
-- TOC entry 5188 (class 0 OID 0)
-- Dependencies: 234
-- Name: video_segments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.video_segments_id_seq', 69, true);


--
-- TOC entry 4957 (class 2606 OID 79636)
-- Name: camera_links camera_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.camera_links
    ADD CONSTRAINT camera_links_pkey PRIMARY KEY (id);


--
-- TOC entry 4959 (class 2606 OID 79638)
-- Name: camera_links camera_links_seat_label_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.camera_links
    ADD CONSTRAINT camera_links_seat_label_key UNIQUE (seat_label);


--
-- TOC entry 4892 (class 2606 OID 79281)
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (course_code);


--
-- TOC entry 4931 (class 2606 OID 79446)
-- Name: detections detections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detections
    ADD CONSTRAINT detections_pkey PRIMARY KEY (id);


--
-- TOC entry 4911 (class 2606 OID 79370)
-- Name: exam_sessions exam_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 4915 (class 2606 OID 79395)
-- Name: feeds feeds_camera_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feeds
    ADD CONSTRAINT feeds_camera_id_key UNIQUE (camera_id);


--
-- TOC entry 4917 (class 2606 OID 79393)
-- Name: feeds feeds_client_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feeds
    ADD CONSTRAINT feeds_client_id_key UNIQUE (client_id);


--
-- TOC entry 4919 (class 2606 OID 79391)
-- Name: feeds feeds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feeds
    ADD CONSTRAINT feeds_pkey PRIMARY KEY (id);


--
-- TOC entry 4953 (class 2606 OID 79589)
-- Name: hardware_gateways hardware_gateways_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hardware_gateways
    ADD CONSTRAINT hardware_gateways_pkey PRIMARY KEY (id);


--
-- TOC entry 4955 (class 2606 OID 79601)
-- Name: proctor_actions proctor_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proctor_actions
    ADD CONSTRAINT proctor_actions_pkey PRIMARY KEY (id);


--
-- TOC entry 4895 (class 2606 OID 79299)
-- Name: sections sections_course_code_section_name_year_year_session_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_course_code_section_name_year_year_session_key UNIQUE (course_code, section_name, year, year_session);


--
-- TOC entry 4897 (class 2606 OID 79297)
-- Name: sections sections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_pkey PRIMARY KEY (section_id);


--
-- TOC entry 4927 (class 2606 OID 79412)
-- Name: session_feeds session_feeds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_feeds
    ADD CONSTRAINT session_feeds_pkey PRIMARY KEY (id);


--
-- TOC entry 4929 (class 2606 OID 79414)
-- Name: session_feeds session_feeds_session_id_feed_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_feeds
    ADD CONSTRAINT session_feeds_session_id_feed_id_key UNIQUE (session_id, feed_id);


--
-- TOC entry 4945 (class 2606 OID 79498)
-- Name: signals signals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signals
    ADD CONSTRAINT signals_pkey PRIMARY KEY (id);


--
-- TOC entry 4907 (class 2606 OID 79339)
-- Name: student_sections student_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_sections
    ADD CONSTRAINT student_sections_pkey PRIMARY KEY (id);


--
-- TOC entry 4909 (class 2606 OID 79341)
-- Name: student_sections student_sections_std_id_section_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_sections
    ADD CONSTRAINT student_sections_std_id_section_id_key UNIQUE (std_id, section_id);


--
-- TOC entry 4901 (class 2606 OID 79318)
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- TOC entry 4903 (class 2606 OID 79320)
-- Name: students students_student_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_student_id_key UNIQUE (student_id);


--
-- TOC entry 4947 (class 2606 OID 79558)
-- Name: subjects subjects_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_name_key UNIQUE (name);


--
-- TOC entry 4949 (class 2606 OID 79556)
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- TOC entry 4951 (class 2606 OID 79575)
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (user_id);


--
-- TOC entry 4938 (class 2606 OID 79471)
-- Name: video_segments video_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_segments
    ADD CONSTRAINT video_segments_pkey PRIMARY KEY (id);


--
-- TOC entry 4960 (class 1259 OID 79644)
-- Name: idx_camera_links_feed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_camera_links_feed ON public.camera_links USING btree (feed_id);


--
-- TOC entry 4961 (class 1259 OID 79645)
-- Name: idx_camera_links_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_camera_links_status ON public.camera_links USING btree (status);


--
-- TOC entry 4932 (class 1259 OID 79459)
-- Name: idx_detections_class; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_detections_class ON public.detections USING btree (class_label);


--
-- TOC entry 4933 (class 1259 OID 79458)
-- Name: idx_detections_feed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_detections_feed ON public.detections USING btree (feed_id, detected_at DESC);


--
-- TOC entry 4934 (class 1259 OID 79457)
-- Name: idx_detections_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_detections_session ON public.detections USING btree (session_id, detected_at DESC);


--
-- TOC entry 4920 (class 1259 OID 79396)
-- Name: idx_feeds_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_feeds_active ON public.feeds USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- TOC entry 4921 (class 1259 OID 79397)
-- Name: idx_feeds_camera_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_feeds_camera_id ON public.feeds USING btree (camera_id) WHERE (camera_id IS NOT NULL);


--
-- TOC entry 4893 (class 1259 OID 79305)
-- Name: idx_sections_course; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sections_course ON public.sections USING btree (course_code);


--
-- TOC entry 4935 (class 1259 OID 79483)
-- Name: idx_segments_feed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_segments_feed ON public.video_segments USING btree (feed_id, started_at DESC);


--
-- TOC entry 4936 (class 1259 OID 79482)
-- Name: idx_segments_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_segments_session ON public.video_segments USING btree (session_id);


--
-- TOC entry 4922 (class 1259 OID 79431)
-- Name: idx_session_feeds_feed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_session_feeds_feed ON public.session_feeds USING btree (feed_id);


--
-- TOC entry 4923 (class 1259 OID 79430)
-- Name: idx_session_feeds_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_session_feeds_session ON public.session_feeds USING btree (session_id);


--
-- TOC entry 4924 (class 1259 OID 79433)
-- Name: idx_session_feeds_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_session_feeds_status ON public.session_feeds USING btree (student_status);


--
-- TOC entry 4925 (class 1259 OID 79432)
-- Name: idx_session_feeds_student; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_session_feeds_student ON public.session_feeds USING btree (student_id);


--
-- TOC entry 4912 (class 1259 OID 79376)
-- Name: idx_sessions_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sessions_active ON public.exam_sessions USING btree (ended_at) WHERE (ended_at IS NULL);


--
-- TOC entry 4913 (class 1259 OID 79377)
-- Name: idx_sessions_section; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sessions_section ON public.exam_sessions USING btree (section_id);


--
-- TOC entry 4939 (class 1259 OID 79510)
-- Name: idx_signals_feed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_signals_feed ON public.signals USING btree (feed_id);


--
-- TOC entry 4940 (class 1259 OID 79513)
-- Name: idx_signals_invigilator; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_signals_invigilator ON public.signals USING btree (invigilator_id);


--
-- TOC entry 4941 (class 1259 OID 79511)
-- Name: idx_signals_sent_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_signals_sent_by ON public.signals USING btree (sent_by);


--
-- TOC entry 4942 (class 1259 OID 79509)
-- Name: idx_signals_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_signals_session ON public.signals USING btree (session_id, sent_at DESC);


--
-- TOC entry 4943 (class 1259 OID 79512)
-- Name: idx_signals_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_signals_type ON public.signals USING btree (action_type);


--
-- TOC entry 4904 (class 1259 OID 79353)
-- Name: idx_student_sections_sec; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_student_sections_sec ON public.student_sections USING btree (section_id);


--
-- TOC entry 4905 (class 1259 OID 79352)
-- Name: idx_student_sections_std; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_student_sections_std ON public.student_sections USING btree (std_id);


--
-- TOC entry 4898 (class 1259 OID 79327)
-- Name: idx_students_section; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_section ON public.students USING btree (section_id);


--
-- TOC entry 4899 (class 1259 OID 79326)
-- Name: idx_students_student_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_student_id ON public.students USING btree (student_id);


--
-- TOC entry 4977 (class 2606 OID 79639)
-- Name: camera_links camera_links_feed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.camera_links
    ADD CONSTRAINT camera_links_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES public.feeds(id) ON DELETE SET NULL;


--
-- TOC entry 4970 (class 2606 OID 79452)
-- Name: detections detections_feed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detections
    ADD CONSTRAINT detections_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES public.feeds(id) ON DELETE SET NULL;


--
-- TOC entry 4971 (class 2606 OID 79447)
-- Name: detections detections_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detections
    ADD CONSTRAINT detections_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.exam_sessions(id) ON DELETE SET NULL;


--
-- TOC entry 4966 (class 2606 OID 79371)
-- Name: exam_sessions exam_sessions_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(section_id) ON DELETE SET NULL;


--
-- TOC entry 4976 (class 2606 OID 79602)
-- Name: proctor_actions proctor_actions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proctor_actions
    ADD CONSTRAINT proctor_actions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.exam_sessions(id);


--
-- TOC entry 4962 (class 2606 OID 79300)
-- Name: sections sections_course_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_course_code_fkey FOREIGN KEY (course_code) REFERENCES public.courses(course_code) ON DELETE CASCADE;


--
-- TOC entry 4967 (class 2606 OID 79420)
-- Name: session_feeds session_feeds_feed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_feeds
    ADD CONSTRAINT session_feeds_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES public.feeds(id) ON DELETE SET NULL;


--
-- TOC entry 4968 (class 2606 OID 79415)
-- Name: session_feeds session_feeds_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_feeds
    ADD CONSTRAINT session_feeds_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.exam_sessions(id) ON DELETE CASCADE;


--
-- TOC entry 4969 (class 2606 OID 79425)
-- Name: session_feeds session_feeds_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session_feeds
    ADD CONSTRAINT session_feeds_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- TOC entry 4974 (class 2606 OID 79504)
-- Name: signals signals_feed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signals
    ADD CONSTRAINT signals_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES public.feeds(id) ON DELETE SET NULL;


--
-- TOC entry 4975 (class 2606 OID 79499)
-- Name: signals signals_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signals
    ADD CONSTRAINT signals_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.exam_sessions(id) ON DELETE SET NULL;


--
-- TOC entry 4964 (class 2606 OID 79347)
-- Name: student_sections student_sections_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_sections
    ADD CONSTRAINT student_sections_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(section_id) ON DELETE CASCADE;


--
-- TOC entry 4965 (class 2606 OID 79342)
-- Name: student_sections student_sections_std_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_sections
    ADD CONSTRAINT student_sections_std_id_fkey FOREIGN KEY (std_id) REFERENCES public.students(student_id) ON DELETE CASCADE;


--
-- TOC entry 4963 (class 2606 OID 79321)
-- Name: students students_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(section_id) ON DELETE SET NULL;


--
-- TOC entry 4972 (class 2606 OID 79477)
-- Name: video_segments video_segments_feed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_segments
    ADD CONSTRAINT video_segments_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES public.feeds(id) ON DELETE SET NULL;


--
-- TOC entry 4973 (class 2606 OID 79472)
-- Name: video_segments video_segments_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_segments
    ADD CONSTRAINT video_segments_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.exam_sessions(id) ON DELETE SET NULL;


-- Completed on 2026-04-26 18:53:30

--
-- PostgreSQL database dump complete
--

\unrestrict t5BncYi6k4YnvdLPu0ZcAQnonKb1Efr3O04cJSWYaSY4IGtqdUVi3KiLJFeJ1lb

