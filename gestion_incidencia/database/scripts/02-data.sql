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

--
-- Data for Name: incidencias; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.incidencias (codigo, jira_id, titulo, descripcion, estado, prioridad, categoria, reportado_por, asignado_a, equipo, origen, causa, solucion, fecha_creacion, fecha_actualizacion, fecha_cierre, sla_vencimiento, id) FROM stdin;
\.


--
-- Data for Name: sugerencias_ia; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sugerencias_ia (incidencia_id, categoria_sugerida, prioridad_sugerida, tiempo_sugerido, descripcion_mejorada, pasos_resolucion, causa_probable, subcategoria, impacto, escalado_recomendado, nivel_escalado, etiquetas, aceptada, motivo_rechazo, creada_en, id) FROM stdin;
\.


--
-- Name: incidencias_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.incidencias_id_seq', 1, false);


--
-- Name: sugerencias_ia_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sugerencias_ia_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--



