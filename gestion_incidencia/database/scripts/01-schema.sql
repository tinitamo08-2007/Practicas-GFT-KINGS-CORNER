--
-- PostgreSQL database dump
--



-- Dumped from database version 15.18 (Debian 15.18-1.pgdg13+1)
-- Dumped by pg_dump version 15.18 (Debian 15.18-1.pgdg13+1)

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: incidencias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.incidencias (
    codigo character varying(20) NOT NULL,
    jira_id character varying(30),
    titulo character varying(255) NOT NULL,
    descripcion text NOT NULL,
    estado character varying(30) DEFAULT 'Nueva'::character varying NOT NULL,
    prioridad character varying(20) NOT NULL,
    categoria character varying(100) NOT NULL,
    reportado_por character varying(150) NOT NULL,
    asignado_a character varying(150),
    equipo character varying(100),
    origen character varying(50) NOT NULL,
    causa text,
    solucion text,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_cierre timestamp without time zone,
    sla_vencimiento timestamp without time zone NOT NULL,
    id integer NOT NULL
);


ALTER TABLE public.incidencias OWNER TO postgres;

--
-- Name: incidencias_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.incidencias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.incidencias_id_seq OWNER TO postgres;

--
-- Name: incidencias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.incidencias_id_seq OWNED BY public.incidencias.id;


--
-- Name: sugerencias_ia; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sugerencias_ia (
    incidencia_id integer NOT NULL,
    categoria_sugerida character varying(50) NOT NULL,
    prioridad_sugerida character varying(10) NOT NULL,
    tiempo_sugerido character varying(50) NOT NULL,
    descripcion_mejorada text NOT NULL,
    pasos_resolucion text NOT NULL,
    causa_probable text,
    subcategoria character varying(50),
    impacto character varying(20),
    escalado_recomendado boolean DEFAULT false,
    nivel_escalado character varying(2),
    etiquetas text[],
    aceptada boolean,
    motivo_rechazo text,
    creada_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    id integer NOT NULL
);


ALTER TABLE public.sugerencias_ia OWNER TO postgres;

--
-- Name: sugerencias_ia_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sugerencias_ia_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sugerencias_ia_id_seq OWNER TO postgres;

--
-- Name: sugerencias_ia_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sugerencias_ia_id_seq OWNED BY public.sugerencias_ia.id;


--
-- Name: incidencias id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidencias ALTER COLUMN id SET DEFAULT nextval('public.incidencias_id_seq'::regclass);


--
-- Name: sugerencias_ia id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sugerencias_ia ALTER COLUMN id SET DEFAULT nextval('public.sugerencias_ia_id_seq'::regclass);


--
-- Name: incidencias incidencias_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_codigo_key UNIQUE (codigo);


--
-- Name: incidencias incidencias_jira_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_jira_id_key UNIQUE (jira_id);


--
-- Name: incidencias incidencias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_pkey PRIMARY KEY (id);


--
-- Name: sugerencias_ia sugerencias_ia_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sugerencias_ia
    ADD CONSTRAINT sugerencias_ia_pkey PRIMARY KEY (id);


--
-- Name: sugerencias_ia; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sugerencias_ia ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--



