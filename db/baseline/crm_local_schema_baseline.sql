--
-- PostgreSQL database dump
--

\restrict iZCJnYWWOMt7UwzjoCtB3OgGdzMNsyIcHxBF4UIBRFj8CGNgRjH6ox0ev9IRa8i

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'SQL_ASCII';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: entegrasyon_tipi_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.entegrasyon_tipi_enum AS ENUM (
    'A2A',
    'D2D',
    'D2D+A2A'
);


--
-- Name: faz_durum_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.faz_durum_enum AS ENUM (
    'Devam Ediyor',
    'Tamamlandı',
    'İhtiyaç Duyulmadı',
    'Başlamadı'
);


--
-- Name: pipeline_event_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pipeline_event_type_enum AS ENUM (
    'set_active',
    'status_changed',
    'dates_updated',
    'owner_changed',
    'skipped',
    'reopened',
    'note_added',
    'PLAN',
    'PLAN_DONE',
    'quote_sent'
);


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


--
-- Name: compute_requests_sla_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_requests_sla_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  deadline timestamptz;
  hours_left numeric;
begin
  if new.sla_hours is null or new.status in ('resolved', 'closed') then
    if new.resolved_at is not null and new.sla_hours is not null then
      deadline := new.created_at + make_interval(hours => new.sla_hours);
      if new.resolved_at <= deadline then
        new.sla_status := 'on_time';
      else
        new.sla_status := 'breached';
      end if;
    else
      new.sla_status := 'na';
    end if;

    return new;
  end if;

  deadline := new.created_at + make_interval(hours => new.sla_hours);
  hours_left := extract(epoch from (deadline - now())) / 3600.0;

  if new.resolved_at is not null then
    new.sla_status := case
      when new.resolved_at <= deadline then 'on_time'
      else 'breached'
    end;
  elsif now() > deadline then
    new.sla_status := 'breached';
  elsif hours_left < (new.sla_hours * 0.25) then
    new.sla_status := 'at_risk';
  else
    new.sla_status := 'on_time';
  end if;

  return new;
end;
$$;


--
-- Name: log_crm_forecast_blocker_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_crm_forecast_blocker_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
 if tg_op='DELETE' then
  insert into public.crm_forecast_blocker_history(blocker_id,customer_id,forecast_id,action,old_data,changed_by_email,changed_by_name)
  values(old.id,old.customer_id,old.forecast_id,'delete',to_jsonb(old),old.updated_by_email,old.updated_by_name); return old;
 end if;
 insert into public.crm_forecast_blocker_history(blocker_id,customer_id,forecast_id,action,old_data,new_data,changed_by_email,changed_by_name)
 values(new.id,new.customer_id,new.forecast_id,lower(tg_op),case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new),new.updated_by_email,new.updated_by_name); return new;
end
$$;


--
-- Name: rebuild_musteri_pipeline(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rebuild_musteri_pipeline(p_musteri_id text) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_row record;
begin
  select
    pe.musteri_id,
    pe.faz_no as aktif_faz_no,
    case
      when pe.durum is null then 'Devam Ediyor'::public.faz_durum_enum
      else pe.durum
    end as durum,
    coalesce(pe.owner, ft.owner) as owner,
    pe.partner_owner,
    pe.hedef_tarihi
  into v_row
  from public.pipeline_eventleri pe
  left join public.faz_tanimlari ft
    on ft.faz_no = pe.faz_no
  where pe.musteri_id::text = p_musteri_id
  order by
    pe.created_at desc,
    pe.id desc
  limit 1;

  if not found then
    delete from public.musteri_pipeline
    where musteri_id::text = p_musteri_id;
    return;
  end if;

  insert into public.musteri_pipeline (
    musteri_id,
    aktif_faz_no,
    durum,
    owner,
    partner_owner,
    hedef_tarihi,
    updated_at
  )
  values (
    v_row.musteri_id,
    v_row.aktif_faz_no,
    v_row.durum,
    v_row.owner,
    v_row.partner_owner,
    v_row.hedef_tarihi,
    now()
  )
  on conflict (musteri_id) do update
  set
    aktif_faz_no = excluded.aktif_faz_no,
    durum = excluded.durum,
    owner = excluded.owner,
    partner_owner = excluded.partner_owner,
    hedef_tarihi = excluded.hedef_tarihi,
    updated_at = excluded.updated_at;
end;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: set_requests_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_requests_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at=now(); return new; end;
$$;


--
-- Name: trg_sync_musteri_pipeline(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_sync_musteri_pipeline() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_faz_owner text;
begin
  if tg_op = 'DELETE' then
    perform public.rebuild_musteri_pipeline(old.musteri_id::text);
    return old;
  end if;

  if tg_op = 'INSERT' then
    select ft.owner
      into v_faz_owner
    from public.faz_tanimlari ft
    where ft.faz_no = new.faz_no;

    insert into public.musteri_pipeline (
      musteri_id,
      aktif_faz_no,
      durum,
      owner,
      partner_owner,
      hedef_tarihi,
      updated_at
    )
    values (
      new.musteri_id,
      new.faz_no,
      case
        when new.durum is null then 'Devam Ediyor'::public.faz_durum_enum
        else new.durum
      end,
      coalesce(new.owner, v_faz_owner),
      new.partner_owner,
      new.hedef_tarihi,
      now()
    )
    on conflict (musteri_id) do update
    set
      aktif_faz_no = excluded.aktif_faz_no,
      durum = excluded.durum,
      owner = excluded.owner,
      partner_owner = excluded.partner_owner,
      hedef_tarihi = excluded.hedef_tarihi,
      updated_at = excluded.updated_at;

    return new;
  end if;

  if old.musteri_id::text is distinct from new.musteri_id::text then
    perform public.rebuild_musteri_pipeline(old.musteri_id::text);
  end if;

  perform public.rebuild_musteri_pipeline(new.musteri_id::text);
  return new;
end;
$$;


--
-- Name: update_kunye_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_kunye_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_
        -- Filter by action early - only get subscriptions interested in this action
        -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
        and (subs.action_filter = '*' or subs.action_filter = action::text);

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  res jsonb;
begin
  if type_::text = 'bytea' then
    return to_jsonb(val);
  end if;
  execute format('select to_jsonb(%L::'|| type_::text || ')', val) into res;
  return res;
end
$$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
_filename text;
BEGIN
	select string_to_array(name, '/') into _parts;
	select _parts[array_length(_parts,1)] into _filename;
	-- @todo return the last part instead of 2
	return reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[1:array_length(_parts,1)-1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::int) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: allowed_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.allowed_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    full_name text,
    role text DEFAULT 'user'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    password_hash text,
    weekly_target_sales_physical integer DEFAULT 0 NOT NULL,
    weekly_target_sales_online integer DEFAULT 0 NOT NULL,
    weekly_target_sales_phone integer DEFAULT 0 NOT NULL,
    weekly_target_sales_email integer DEFAULT 0 NOT NULL,
    weekly_target_technical_physical integer DEFAULT 0 NOT NULL,
    weekly_target_technical_online integer DEFAULT 0 NOT NULL,
    weekly_target_total_activities integer DEFAULT 0 NOT NULL,
    weekly_target_unique_customers integer DEFAULT 0 NOT NULL
);


--
-- Name: crm_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_audit_logs (
    id bigint NOT NULL,
    actor_user_id text,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    before_data jsonb,
    after_data jsonb,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.crm_audit_logs ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.crm_audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: crm_forecast_blocker_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_forecast_blocker_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    blocker_id uuid,
    customer_id uuid,
    forecast_id uuid,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_by_email text,
    changed_by_name text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_forecast_blockers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_forecast_blockers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    forecast_id uuid,
    has_blocker boolean NOT NULL,
    blocker_category text,
    blocker_description text,
    resolution_owner_type text,
    resolution_owner_name text,
    resolution_due_date date,
    impact_type text DEFAULT 'none'::text NOT NULL,
    shift_year integer,
    shift_month integer,
    shifted_quantity integer,
    workflow_status text DEFAULT 'open'::text NOT NULL,
    manager_note text,
    reviewed_at timestamp with time zone,
    reviewed_by_email text,
    reviewed_by_name text,
    submitted_at timestamp with time zone,
    submitted_by_email text,
    submitted_by_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_email text,
    created_by_name text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_email text,
    updated_by_name text,
    resolved_at timestamp with time zone,
    resolved_by_email text,
    resolved_by_name text,
    CONSTRAINT crm_forecast_blockers_category_allowed CHECK (((blocker_category IS NULL) OR (blocker_category = ANY (ARRAY['customer_decision'::text, 'pricing'::text, 'technical'::text, 'integration'::text, 'contract_legal'::text, 'bank_partner'::text, 'stock_supply'::text, 'internal_approval'::text, 'operation'::text, 'other'::text])))),
    CONSTRAINT crm_forecast_blockers_impact_type_check CHECK ((impact_type = ANY (ARRAY['none'::text, 'month_shift'::text]))),
    CONSTRAINT crm_forecast_blockers_owner_type_allowed CHECK (((resolution_owner_type IS NULL) OR (resolution_owner_type = ANY (ARRAY['internal'::text, 'customer'::text, 'bank'::text, 'partner'::text, 'other'::text])))),
    CONSTRAINT crm_forecast_blockers_shift_month_check CHECK (((shift_month IS NULL) OR ((shift_month >= 1) AND (shift_month <= 12)))),
    CONSTRAINT crm_forecast_blockers_shift_year_check CHECK (((shift_year IS NULL) OR ((shift_year >= 2024) AND (shift_year <= 2100)))),
    CONSTRAINT crm_forecast_blockers_shifted_quantity_check CHECK (((shifted_quantity IS NULL) OR (shifted_quantity > 0))),
    CONSTRAINT crm_forecast_blockers_workflow_status_check CHECK ((workflow_status = ANY (ARRAY['no_blocker'::text, 'open'::text, 'in_progress'::text, 'resolved'::text])))
);


--
-- Name: crm_forecasts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_forecasts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    product_id text,
    product_code_snapshot text,
    product_name_snapshot text NOT NULL,
    quantity integer NOT NULL,
    forecast_year integer NOT NULL,
    forecast_month integer NOT NULL,
    sales_channel text NOT NULL,
    probability integer NOT NULL,
    owner_name text NOT NULL,
    owner_email text,
    owner_user_id text,
    note text,
    is_active boolean DEFAULT true NOT NULL,
    created_by_email text,
    created_by_name text,
    updated_by_email text,
    updated_by_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_forecasts_forecast_month_check CHECK (((forecast_month >= 1) AND (forecast_month <= 12))),
    CONSTRAINT crm_forecasts_forecast_year_check CHECK (((forecast_year >= 2024) AND (forecast_year <= 2100))),
    CONSTRAINT crm_forecasts_probability_check CHECK ((probability = ANY (ARRAY[30, 60, 90]))),
    CONSTRAINT crm_forecasts_quantity_check CHECK ((quantity > 0))
);


--
-- Name: crm_performance_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_performance_snapshots (
    id bigint NOT NULL,
    metric_id bigint NOT NULL,
    scope_type text NOT NULL,
    scope_id text,
    period_start date NOT NULL,
    period_end date NOT NULL,
    actual_value numeric(18,2),
    source_status text NOT NULL,
    source_updated_at timestamp with time zone,
    calculated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT crm_performance_snapshots_scope_type_check CHECK ((scope_type = ANY (ARRAY['company'::text, 'team'::text, 'user'::text]))),
    CONSTRAINT crm_performance_snapshots_source_status_check CHECK ((source_status = ANY (ARRAY['ready'::text, 'source_not_connected'::text, 'target_missing'::text, 'setup_required'::text])))
);


--
-- Name: crm_performance_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.crm_performance_snapshots ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.crm_performance_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: crm_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_permissions (
    id bigint NOT NULL,
    code text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.crm_permissions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.crm_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: crm_role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_role_permissions (
    role_id bigint NOT NULL,
    permission_id bigint NOT NULL
);


--
-- Name: crm_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_roles (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    is_system boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.crm_roles ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.crm_roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: crm_target_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_target_metrics (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    unit text NOT NULL,
    currency text,
    data_source text,
    calculation_method text,
    is_active boolean DEFAULT true NOT NULL,
    dashboard_enabled boolean DEFAULT true NOT NULL,
    allowed_scopes text[] DEFAULT ARRAY['company'::text, 'team'::text, 'user'::text] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_target_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.crm_target_metrics ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.crm_target_metrics_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: crm_target_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_target_revisions (
    id bigint NOT NULL,
    target_id bigint NOT NULL,
    revision_no integer NOT NULL,
    previous_value numeric(18,2),
    new_value numeric(18,2) NOT NULL,
    note text NOT NULL,
    changed_by_user_id text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_target_revisions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.crm_target_revisions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.crm_target_revisions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: crm_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_targets (
    id bigint NOT NULL,
    metric_id bigint NOT NULL,
    scope_type text NOT NULL,
    scope_id text,
    period_type text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    target_value numeric(18,2) NOT NULL,
    currency text,
    revision_no integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by_user_id text,
    updated_by_user_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_targets_check CHECK ((end_date >= start_date)),
    CONSTRAINT crm_targets_check1 CHECK ((((scope_type = 'company'::text) AND (scope_id IS NULL)) OR ((scope_type <> 'company'::text) AND (scope_id IS NOT NULL)))),
    CONSTRAINT crm_targets_period_type_check CHECK ((period_type = ANY (ARRAY['year'::text, 'month'::text, 'week'::text, 'custom'::text]))),
    CONSTRAINT crm_targets_scope_type_check CHECK ((scope_type = ANY (ARRAY['company'::text, 'team'::text, 'user'::text]))),
    CONSTRAINT crm_targets_target_value_check CHECK ((target_value >= (0)::numeric))
);


--
-- Name: crm_targets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.crm_targets ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.crm_targets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: crm_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_team_members (
    team_id bigint NOT NULL,
    user_id text NOT NULL,
    is_manager boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    valid_from timestamp with time zone DEFAULT now() NOT NULL,
    valid_until timestamp with time zone
);


--
-- Name: crm_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_teams (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    manager_user_id text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_teams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.crm_teams ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.crm_teams_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: crm_tv_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_tv_devices (
    id bigint NOT NULL,
    name text NOT NULL,
    activation_code_hash text,
    device_token_hash text,
    allowed_dashboard text DEFAULT 'sales-performance'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    activated_at timestamp with time zone,
    last_seen_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_by_user_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_tv_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.crm_tv_devices ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.crm_tv_devices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: crm_user_permission_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_user_permission_overrides (
    user_id text NOT NULL,
    permission_id bigint NOT NULL,
    effect text NOT NULL,
    reason text,
    assigned_by_user_id text,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_user_permission_overrides_effect_check CHECK ((effect = ANY (ARRAY['allow'::text, 'deny'::text])))
);


--
-- Name: crm_user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_user_roles (
    user_id text NOT NULL,
    role_id bigint NOT NULL,
    assigned_by_user_id text,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: faz_hareketleri; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faz_hareketleri (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    musteri_id uuid NOT NULL,
    faz_id uuid NOT NULL,
    baslangic_tarihi date,
    hedef_tarihi date,
    durum public.faz_durum_enum,
    kanal text,
    notlar text,
    owner text,
    partner_owner text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: faz_tanimlari; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faz_tanimlari (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    faz_no integer NOT NULL,
    asama_adi text NOT NULL,
    amac text,
    detay text,
    cikis_kriteri text,
    created_at timestamp with time zone DEFAULT now(),
    owner text
);


--
-- Name: import_teknik_aktiviteler; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_teknik_aktiviteler (
    id bigint NOT NULL,
    musteri_adi text NOT NULL,
    aktivite_tipi text NOT NULL,
    notlar text,
    created_by text,
    created_at timestamp with time zone,
    CONSTRAINT import_teknik_aktiviteler_aktivite_tipi_check CHECK ((aktivite_tipi = ANY (ARRAY['Teknik Ziyaret'::text, 'Teknik Online'::text, 'Yerinde Ziyaret'::text, 'Online Görüşme'::text, 'Telefon'::text, 'E-Posta'::text])))
);


--
-- Name: import_teknik_aktiviteler_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.import_teknik_aktiviteler_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: import_teknik_aktiviteler_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.import_teknik_aktiviteler_id_seq OWNED BY public.import_teknik_aktiviteler.id;


--
-- Name: is_ortagi_faz_tanimlari; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.is_ortagi_faz_tanimlari (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    faz_no integer NOT NULL,
    asama_adi text NOT NULL,
    owner text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: musteri_account_change_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.musteri_account_change_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    musteri_id uuid NOT NULL,
    musteri text NOT NULL,
    current_account text,
    requested_account text NOT NULL,
    requested_by text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    review_note text,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT musteri_account_change_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: musteri_kunye; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.musteri_kunye (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    musteri_id uuid NOT NULL,
    magaza_sayisi text,
    toplam_pos_adedi integer,
    pos_modeli text,
    pos_notu text,
    el_terminali_modeli text,
    el_terminali_adedi integer,
    reyon_cihaz_modeli text,
    reyon_cihazi_adedi integer,
    sabit_kasa_yazilimi text,
    reyon_odeme_yazilimi text,
    erp text,
    bankalar text[],
    pos_mulkiyet text,
    saha_hizmeti_firmasi text,
    account text,
    entegrasyon_yapisi text,
    risk text,
    genel_memnuniyet text,
    problem_1 text,
    problem_2 text,
    problem_3 text,
    degisim_nedeni text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    pos_mulkiyet_bankalari text[],
    franchise_sayisi text,
    sabit_kasa_adedi text,
    reyon_cihaz_sayisi integer,
    pos_markasi text,
    pos_alim_yili text,
    sabit_bilgisayar_markasi text,
    reyon_alim_yili text,
    el_terminali_yazilimi text,
    el_terminali_alim_yili text
);


--
-- Name: COLUMN musteri_kunye.bankalar; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.musteri_kunye.bankalar IS 'Ekranda Hangi bankalar';


--
-- Name: COLUMN musteri_kunye.pos_mulkiyet_bankalari; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.musteri_kunye.pos_mulkiyet_bankalari IS 'POS Cihazı Mülkiyeti = Banka ise seçilen bankalar listesi';


--
-- Name: musteri_kunye_v2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.musteri_kunye_v2 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    musteri_id uuid NOT NULL,
    magaza_sayisi text,
    franchise_sayisi text,
    sabit_kasa_adedi text,
    kasapos_firmasi text,
    pos_modeli text,
    pos_markasi text,
    toplam_pos_adedi integer,
    pos_alim_yili text,
    sabit_bilgisayar_markasi text,
    pos_notu text,
    reyon_kullaniliyor text DEFAULT 'Hayır'::text,
    reyon_odeme_yazilimi text,
    reyon_cihaz_modeli text,
    reyon_cihaz_sayisi integer,
    reyon_alim_yili text,
    el_terminali_kullaniliyor text DEFAULT 'Hayır'::text,
    el_terminali_modeli text,
    el_terminali_yazilimi text,
    el_terminali_adedi integer,
    el_terminali_alim_yili text,
    erp text,
    bankalar text[],
    pos_mulkiyet text,
    pos_mulkiyet_bankalari text[],
    saha_hizmeti_firmasi text,
    genel_memnuniyet text,
    risk text,
    entegrasyon_yapisi text,
    account text,
    problem_1 text,
    problem_2 text,
    problem_3 text,
    degisim_nedeni text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by text,
    CONSTRAINT musteri_kunye_v2_el_terminali_kullaniliyor_check CHECK (((el_terminali_kullaniliyor = ANY (ARRAY['Evet'::text, 'Hayır'::text])) OR (el_terminali_kullaniliyor IS NULL))),
    CONSTRAINT musteri_kunye_v2_reyon_kullaniliyor_check CHECK (((reyon_kullaniliyor = ANY (ARRAY['Evet'::text, 'Hayır'::text])) OR (reyon_kullaniliyor IS NULL)))
);


--
-- Name: COLUMN musteri_kunye_v2.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.musteri_kunye_v2.updated_at IS 'Künye bilgisinin son güncellenme zamanı.';


--
-- Name: COLUMN musteri_kunye_v2.updated_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.musteri_kunye_v2.updated_by IS 'Künye bilgisini en son güncelleyen kullanıcı adı/e-posta.';


--
-- Name: musteri_pipeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.musteri_pipeline (
    musteri_id uuid NOT NULL,
    aktif_faz_no integer,
    aktif_iteration_no integer DEFAULT 1,
    durum public.faz_durum_enum,
    owner text,
    partner_owner text,
    baslangic_tarihi date,
    hedef_tarihi date,
    notlar text,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ck_pipeline_tarih_mantigi CHECK (((baslangic_tarihi IS NULL) OR (hedef_tarihi IS NULL) OR (baslangic_tarihi <= hedef_tarihi)))
);


--
-- Name: musteriler; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.musteriler (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    musteri text NOT NULL,
    satis_olasiligi text,
    sorumlu text,
    created_at timestamp with time zone DEFAULT now(),
    entegrasyon_tipi public.entegrasyon_tipi_enum,
    sektor text,
    updated_by text,
    updated_at timestamp with time zone,
    owner_user_id uuid
);


--
-- Name: COLUMN musteriler.satis_olasiligi; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.musteriler.satis_olasiligi IS 'Ekranda Satış Olasılığı olarak kullanılır';


--
-- Name: COLUMN musteriler.updated_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.musteriler.updated_by IS 'Müşteri temel bilgisini en son güncelleyen kullanıcı adı/e-posta.';


--
-- Name: COLUMN musteriler.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.musteriler.updated_at IS 'Müşteri temel bilgisinin son güncellenme zamanı.';


--
-- Name: COLUMN musteriler.owner_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.musteriler.owner_user_id IS 'Primary CRM customer owner identity. Legacy sorumlu text remains as a temporary compatibility fallback.';


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pipeline_eventleri; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_eventleri (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    musteri_id uuid NOT NULL,
    faz_no integer,
    iteration_no integer DEFAULT 1,
    event_type public.pipeline_event_type_enum NOT NULL,
    durum public.faz_durum_enum,
    owner text,
    partner_owner text,
    baslangic_tarihi date,
    hedef_tarihi date,
    notlar text,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now(),
    aksiyon text,
    created_by text,
    is_blocked boolean DEFAULT false NOT NULL,
    blocked_note text,
    blocked_at timestamp with time zone,
    blocked_by text,
    activity_scope text DEFAULT 'account'::text NOT NULL,
    affects_phase boolean DEFAULT true NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    owner_user_id text,
    CONSTRAINT pipeline_eventleri_activity_scope_check CHECK ((activity_scope = ANY (ARRAY['account'::text, 'technical'::text])))
);


--
-- Name: quote_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    line_no integer NOT NULL,
    product_id uuid NOT NULL,
    product_code_snapshot text NOT NULL,
    product_name_snapshot text NOT NULL,
    product_type text NOT NULL,
    category text NOT NULL,
    is_recurring boolean DEFAULT false NOT NULL,
    billing_period text DEFAULT 'one_time'::text NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    total_price numeric(14,2) NOT NULL,
    rule_min_qty integer,
    rule_max_qty integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_items_quantity_check CHECK ((quantity > 0))
);


--
-- Name: quote_pricing_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_pricing_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    min_qty integer NOT NULL,
    max_qty integer,
    unit_price numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_pricing_rules_qty_chk CHECK (((min_qty > 0) AND ((max_qty IS NULL) OR (max_qty >= min_qty))))
);


--
-- Name: quote_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    product_type text NOT NULL,
    unit_label text DEFAULT 'adet'::text NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    is_recurring boolean DEFAULT false NOT NULL,
    billing_period text DEFAULT 'one_time'::text NOT NULL,
    description text,
    specs jsonb DEFAULT '[]'::jsonb NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_products_billing_period_check CHECK ((billing_period = ANY (ARRAY['one_time'::text, 'monthly'::text]))),
    CONSTRAINT quote_products_product_type_check CHECK ((product_type = ANY (ARRAY['device'::text, 'bundle'::text, 'recurring'::text, 'peripheral'::text])))
);


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    opportunity_title text,
    proposal_date date NOT NULL,
    valid_until date NOT NULL,
    follow_up_date date NOT NULL,
    owner_name text NOT NULL,
    owner_email text,
    probability integer NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    closed_reason text,
    total_device_count integer DEFAULT 0 NOT NULL,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    hardware_amount numeric(14,2) DEFAULT 0 NOT NULL,
    monthly_amount numeric(14,2) DEFAULT 0 NOT NULL,
    note text,
    quote_year integer NOT NULL,
    quote_serial integer NOT NULL,
    quote_no text NOT NULL,
    activity_event_id uuid,
    pdf_url text,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_user_id text,
    CONSTRAINT quotes_closed_reason_check CHECK ((closed_reason = ANY (ARRAY['won'::text, 'lost'::text, 'expired'::text, 'no_interest'::text]))),
    CONSTRAINT quotes_probability_check CHECK ((probability = ANY (ARRAY[10, 30, 60, 90]))),
    CONSTRAINT quotes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'closed'::text])))
);


--
-- Name: request_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.request_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    sla_hours integer DEFAULT 24 NOT NULL,
    default_team_id uuid,
    color text DEFAULT '#2563eb'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: request_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.request_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    actor_id uuid,
    actor_name text,
    event_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT request_events_event_type_check CHECK ((event_type = ANY (ARRAY['created'::text, 'assigned'::text, 'reassigned'::text, 'status_changed'::text, 'comment'::text, 'priority_changed'::text, 'due_changed'::text, 'ai_action'::text])))
);


--
-- Name: requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    requester_id uuid NOT NULL,
    requester_name text,
    assignee_id uuid,
    assignee_name text,
    assignee_source text DEFAULT 'manual'::text NOT NULL,
    team_id uuid,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    category_id uuid,
    priority text DEFAULT 'medium'::text NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    channel text DEFAULT 'manual'::text NOT NULL,
    source_ref text,
    source_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    due_at timestamp with time zone,
    first_response_at timestamp with time zone,
    resolved_at timestamp with time zone,
    sla_hours integer,
    sla_status text DEFAULT 'on_time'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    resolution_note text,
    ai_intent text,
    ai_confidence real,
    ai_suggested_assignee uuid,
    ai_suggested_category text,
    ai_raw_response jsonb,
    CONSTRAINT requests_assignee_source_check CHECK ((assignee_source = ANY (ARRAY['manual'::text, 'ai_suggested'::text, 'ai_auto'::text]))),
    CONSTRAINT requests_channel_check CHECK ((channel = ANY (ARRAY['manual'::text, 'whatsapp'::text, 'email'::text, 'system'::text]))),
    CONSTRAINT requests_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT requests_sla_status_check CHECK ((sla_status = ANY (ARRAY['on_time'::text, 'at_risk'::text, 'breached'::text, 'na'::text]))),
    CONSTRAINT requests_status_check CHECK ((status = ANY (ARRAY['open'::text, 'assigned'::text, 'in_progress'::text, 'waiting'::text, 'resolved'::text, 'closed'::text])))
);


--
-- Name: system_parameters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_parameters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_key text NOT NULL,
    param_key text NOT NULL,
    label text NOT NULL,
    value text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    routing_rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: v_crm_forecast_blocker_impact; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_crm_forecast_blocker_impact AS
 SELECT m.id AS customer_id,
    m.musteri,
    m.sektor,
    m.sorumlu,
    m.entegrasyon_tipi,
    sf.id AS forecast_id,
    sf.product_id,
    sf.product_code_snapshot,
    sf.product_name_snapshot,
    sf.quantity,
    sf.forecast_year,
    sf.forecast_month,
        CASE
            WHEN (sf.id IS NULL) THEN 'Aktif Forecast yok'::text
            ELSE ((lpad((sf.forecast_month)::text, 2, '0'::text) || '/'::text) || (sf.forecast_year)::text)
        END AS forecast_period_label,
    sf.owner_name,
    sf.owner_email,
    COALESCE(fs.active_forecast_count, 0) AS active_forecast_count,
    COALESCE(fs.total_forecast_quantity, 0) AS total_forecast_quantity,
    COALESCE(fs.forecast_options, '[]'::jsonb) AS forecast_options,
    b.id AS blocker_id,
    b.has_blocker,
    b.blocker_category,
    b.blocker_description,
    b.resolution_owner_type,
    b.resolution_owner_name,
    b.resolution_due_date,
    b.impact_type,
    b.shift_year,
    b.shift_month,
    b.shifted_quantity,
        CASE
            WHEN ((b.shift_year IS NULL) OR (b.shift_month IS NULL)) THEN NULL::text
            ELSE ((lpad((b.shift_month)::text, 2, '0'::text) || '/'::text) || (b.shift_year)::text)
        END AS shift_period_label,
    b.workflow_status,
    b.manager_note,
    b.reviewed_at,
    b.reviewed_by_email,
    b.reviewed_by_name,
    b.submitted_at,
    b.submitted_by_email,
    b.submitted_by_name,
    b.updated_at,
    b.updated_by_email,
    b.updated_by_name,
    b.resolved_at,
        CASE
            WHEN (b.id IS NULL) THEN 'pending'::text
            WHEN (NOT b.has_blocker) THEN 'no_blocker'::text
            WHEN (b.workflow_status = 'resolved'::text) THEN 'resolved'::text
            WHEN (b.resolution_due_date < CURRENT_DATE) THEN 'overdue'::text
            WHEN (b.workflow_status = 'in_progress'::text) THEN 'in_progress'::text
            ELSE 'open'::text
        END AS effective_status
   FROM (((public.musteriler m
     LEFT JOIN public.crm_forecast_blockers b ON ((b.customer_id = m.id)))
     LEFT JOIN LATERAL ( SELECT (count(*))::integer AS active_forecast_count,
            (COALESCE(sum(f.quantity), (0)::bigint))::integer AS total_forecast_quantity,
            jsonb_agg(jsonb_build_object('forecast_id', (f.id)::text, 'product_code', f.product_code_snapshot, 'product_name', f.product_name_snapshot, 'quantity', f.quantity, 'year', f.forecast_year, 'month', f.forecast_month)) AS forecast_options
           FROM public.crm_forecasts f
          WHERE ((f.customer_id = m.id) AND (f.is_active = true))) fs ON (true))
     LEFT JOIN LATERAL ( SELECT f.id,
            f.customer_id,
            f.product_id,
            f.product_code_snapshot,
            f.product_name_snapshot,
            f.quantity,
            f.forecast_year,
            f.forecast_month,
            f.sales_channel,
            f.probability,
            f.owner_name,
            f.owner_email,
            f.owner_user_id,
            f.note,
            f.is_active,
            f.created_by_email,
            f.created_by_name,
            f.updated_by_email,
            f.updated_by_name,
            f.created_at,
            f.updated_at
           FROM public.crm_forecasts f
          WHERE ((f.customer_id = m.id) AND ((f.is_active = true) OR (f.id = b.forecast_id)))
          ORDER BY
                CASE
                    WHEN (f.id = b.forecast_id) THEN 0
                    ELSE 1
                END, f.forecast_year, f.forecast_month
         LIMIT 1) sf ON (true));


--
-- Name: v_crm_forecast_report; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_crm_forecast_report AS
 SELECT f.id,
    f.customer_id,
    f.product_id,
    f.product_code_snapshot,
    f.product_name_snapshot,
    f.quantity,
    f.forecast_year,
    f.forecast_month,
    f.sales_channel,
    f.probability,
    f.owner_name,
    f.owner_email,
    f.owner_user_id,
    f.note,
    f.is_active,
    f.created_by_email,
    f.created_by_name,
    f.updated_by_email,
    f.updated_by_name,
    f.created_at,
    f.updated_at,
    m.musteri,
    m.sektor,
    m.sorumlu,
    m.entegrasyon_tipi,
    round((((f.quantity)::numeric * (f.probability)::numeric) / (100)::numeric), 2) AS weighted_quantity
   FROM (public.crm_forecasts f
     JOIN public.musteriler m ON ((m.id = f.customer_id)));


--
-- Name: v_musteri_kunye_form; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_musteri_kunye_form AS
 SELECT m.id AS musteri_id,
    m.musteri AS firma_adi,
    m.sektor,
    k.account AS musteri_account,
    k.id AS kunye_id,
    k.magaza_sayisi,
    k.franchise_sayisi,
    k.sabit_kasa_adedi,
    k.kasapos_firmasi,
    k.pos_modeli,
    k.pos_markasi,
    k.toplam_pos_adedi,
    k.pos_alim_yili,
    k.sabit_bilgisayar_markasi,
    k.pos_notu,
    k.reyon_kullaniliyor,
    k.reyon_odeme_yazilimi,
    k.reyon_cihaz_modeli,
    k.reyon_cihaz_sayisi,
    k.reyon_alim_yili,
    k.el_terminali_kullaniliyor,
    k.el_terminali_modeli,
    k.el_terminali_yazilimi,
    k.el_terminali_adedi,
    k.el_terminali_alim_yili,
    k.erp,
    k.bankalar,
    k.pos_mulkiyet,
    k.pos_mulkiyet_bankalari,
    k.saha_hizmeti_firmasi,
    k.genel_memnuniyet,
    k.risk,
    k.entegrasyon_yapisi,
    k.problem_1,
    k.problem_2,
    k.problem_3,
    k.degisim_nedeni,
    k.created_at,
    k.updated_at
   FROM (public.musteriler m
     LEFT JOIN public.musteri_kunye_v2 k ON ((k.musteri_id = m.id)));


--
-- Name: v_musteri_kunye_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_musteri_kunye_status AS
 WITH base AS (
         SELECT k.musteri_id,
            k.firma_adi,
            k.sektor,
            k.musteri_account,
            k.kunye_id,
            k.magaza_sayisi,
            k.franchise_sayisi,
            k.sabit_kasa_adedi,
            k.kasapos_firmasi,
            k.pos_modeli,
            k.pos_markasi,
            k.toplam_pos_adedi,
            k.pos_alim_yili,
            k.sabit_bilgisayar_markasi,
            k.pos_notu,
            k.reyon_kullaniliyor,
            k.reyon_odeme_yazilimi,
            k.reyon_cihaz_modeli,
            k.reyon_cihaz_sayisi,
            k.reyon_alim_yili,
            k.el_terminali_kullaniliyor,
            k.el_terminali_modeli,
            k.el_terminali_yazilimi,
            k.el_terminali_adedi,
            k.el_terminali_alim_yili,
            k.erp,
            k.bankalar,
            k.pos_mulkiyet,
            k.pos_mulkiyet_bankalari,
            k.saha_hizmeti_firmasi,
            k.genel_memnuniyet,
            k.risk,
            k.entegrasyon_yapisi,
            k.problem_1,
            k.problem_2,
            k.problem_3,
            k.degisim_nedeni,
            k.created_at,
            k.updated_at,
            ((((
                CASE
                    WHEN (k.magaza_sayisi IS NOT NULL) THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN (k.kasapos_firmasi IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.pos_modeli IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.pos_markasi IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.toplam_pos_adedi IS NOT NULL) THEN 1
                    ELSE 0
                END) AS required_filled,
            (((((((((((((((((((((((((((((((
                CASE
                    WHEN (k.magaza_sayisi IS NOT NULL) THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN (k.franchise_sayisi IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.sabit_kasa_adedi IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.kasapos_firmasi IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.pos_modeli IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.pos_markasi IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.toplam_pos_adedi IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.pos_alim_yili IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.sabit_bilgisayar_markasi IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.pos_notu IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.reyon_kullaniliyor IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN ((k.reyon_kullaniliyor = 'Evet'::text) AND (k.reyon_odeme_yazilimi IS NOT NULL)) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN ((k.reyon_kullaniliyor = 'Evet'::text) AND (k.reyon_cihaz_modeli IS NOT NULL)) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN ((k.reyon_kullaniliyor = 'Evet'::text) AND (k.reyon_cihaz_sayisi IS NOT NULL)) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN ((k.reyon_kullaniliyor = 'Evet'::text) AND (k.reyon_alim_yili IS NOT NULL)) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.el_terminali_kullaniliyor IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN ((k.el_terminali_kullaniliyor = 'Evet'::text) AND (k.el_terminali_modeli IS NOT NULL)) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN ((k.el_terminali_kullaniliyor = 'Evet'::text) AND (k.el_terminali_yazilimi IS NOT NULL)) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN ((k.el_terminali_kullaniliyor = 'Evet'::text) AND (k.el_terminali_adedi IS NOT NULL)) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN ((k.el_terminali_kullaniliyor = 'Evet'::text) AND (k.el_terminali_alim_yili IS NOT NULL)) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.erp IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.bankalar IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.pos_mulkiyet IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN ((k.pos_mulkiyet = 'Bankada'::text) AND (k.pos_mulkiyet_bankalari IS NOT NULL)) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.saha_hizmeti_firmasi IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.genel_memnuniyet IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.risk IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.entegrasyon_yapisi IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.problem_1 IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.problem_2 IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.problem_3 IS NOT NULL) THEN 1
                    ELSE 0
                END) +
                CASE
                    WHEN (k.degisim_nedeni IS NOT NULL) THEN 1
                    ELSE 0
                END) AS filled_fields,
            (((((10 + 1) +
                CASE
                    WHEN (k.reyon_kullaniliyor = 'Evet'::text) THEN 4
                    ELSE 0
                END) + 1) +
                CASE
                    WHEN (k.el_terminali_kullaniliyor = 'Evet'::text) THEN 4
                    ELSE 0
                END) + 10) AS total_fields
           FROM public.v_musteri_kunye_form k
        ), scored AS (
         SELECT b.musteri_id,
            b.firma_adi,
            b.sektor,
            b.musteri_account,
            b.kunye_id,
            b.magaza_sayisi,
            b.franchise_sayisi,
            b.sabit_kasa_adedi,
            b.kasapos_firmasi,
            b.pos_modeli,
            b.pos_markasi,
            b.toplam_pos_adedi,
            b.pos_alim_yili,
            b.sabit_bilgisayar_markasi,
            b.pos_notu,
            b.reyon_kullaniliyor,
            b.reyon_odeme_yazilimi,
            b.reyon_cihaz_modeli,
            b.reyon_cihaz_sayisi,
            b.reyon_alim_yili,
            b.el_terminali_kullaniliyor,
            b.el_terminali_modeli,
            b.el_terminali_yazilimi,
            b.el_terminali_adedi,
            b.el_terminali_alim_yili,
            b.erp,
            b.bankalar,
            b.pos_mulkiyet,
            b.pos_mulkiyet_bankalari,
            b.saha_hizmeti_firmasi,
            b.genel_memnuniyet,
            b.risk,
            b.entegrasyon_yapisi,
            b.problem_1,
            b.problem_2,
            b.problem_3,
            b.degisim_nedeni,
            b.created_at,
            b.updated_at,
            b.required_filled,
            b.filled_fields,
            b.total_fields,
            round((((b.filled_fields)::numeric / (GREATEST(b.total_fields, 1))::numeric) * (100)::numeric), 2) AS completion_pct
           FROM base b
        )
 SELECT musteri_id,
    firma_adi,
    sektor,
    musteri_account,
    kunye_id,
    magaza_sayisi,
    franchise_sayisi,
    sabit_kasa_adedi,
    kasapos_firmasi,
    pos_modeli,
    pos_markasi,
    toplam_pos_adedi,
    pos_alim_yili,
    sabit_bilgisayar_markasi,
    pos_notu,
    reyon_kullaniliyor,
    reyon_odeme_yazilimi,
    reyon_cihaz_modeli,
    reyon_cihaz_sayisi,
    reyon_alim_yili,
    el_terminali_kullaniliyor,
    el_terminali_modeli,
    el_terminali_yazilimi,
    el_terminali_adedi,
    el_terminali_alim_yili,
    erp,
    bankalar,
    pos_mulkiyet,
    pos_mulkiyet_bankalari,
    saha_hizmeti_firmasi,
    genel_memnuniyet,
    risk,
    entegrasyon_yapisi,
    problem_1,
    problem_2,
    problem_3,
    degisim_nedeni,
    created_at,
    updated_at,
    required_filled,
    filled_fields,
    total_fields,
    completion_pct,
        CASE
            WHEN (required_filled <= 1) THEN 'yok'::text
            WHEN (required_filled < 5) THEN 'eksik'::text
            WHEN (completion_pct < (20)::numeric) THEN 'yok'::text
            WHEN (completion_pct <= (60)::numeric) THEN 'eksik'::text
            ELSE 'dolu'::text
        END AS kunye_status
   FROM scored s;


--
-- Name: vw_crm_musteriler; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_crm_musteriler AS
 SELECT m.id AS musteri_id,
    m.musteri,
    m.sektor,
    m.entegrasyon_tipi,
    m.satis_olasiligi AS risk,
    m.sorumlu,
    mp.aktif_faz_no,
    ft.asama_adi AS aktif_faz_adi,
    mp.durum AS pipeline_durum,
    mp.updated_at AS pipeline_guncelleme,
    pe.event_type AS son_event_type,
    pe.notlar AS son_not,
    pe.partner_owner AS bekleyen_taraf,
    pe.created_at AS son_event_zamani
   FROM (((public.musteriler m
     LEFT JOIN public.musteri_pipeline mp ON ((mp.musteri_id = m.id)))
     LEFT JOIN public.faz_tanimlari ft ON ((ft.faz_no = mp.aktif_faz_no)))
     LEFT JOIN LATERAL ( SELECT pe_1.id,
            pe_1.musteri_id,
            pe_1.faz_no,
            pe_1.iteration_no,
            pe_1.event_type,
            pe_1.durum,
            pe_1.owner,
            pe_1.partner_owner,
            pe_1.baslangic_tarihi,
            pe_1.hedef_tarihi,
            pe_1.notlar,
            pe_1.payload,
            pe_1.created_at,
            pe_1.aksiyon
           FROM public.pipeline_eventleri pe_1
          WHERE (pe_1.musteri_id = m.id)
          ORDER BY pe_1.created_at DESC
         LIMIT 1) pe ON (true));


--
-- Name: vw_crm_report_accounts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_crm_report_accounts AS
 WITH latest_event AS (
         SELECT DISTINCT ON (pe.musteri_id) pe.musteri_id,
            pe.id AS last_event_id,
            pe.faz_no AS event_faz_no,
            pe.iteration_no,
            pe.event_type,
            pe.durum AS event_durum,
            pe.aksiyon AS son_aksiyon,
            pe.owner AS event_owner,
            pe.partner_owner AS event_partner_owner,
            pe.baslangic_tarihi AS event_baslangic_tarihi,
            pe.hedef_tarihi AS event_hedef_tarihi,
            pe.notlar AS son_not,
            pe.created_at AS son_aktivite_tarihi
           FROM public.pipeline_eventleri pe
          WHERE (pe.musteri_id IS NOT NULL)
          ORDER BY pe.musteri_id, pe.created_at DESC, pe.id DESC
        )
 SELECT m.id AS musteri_id,
    m.musteri,
    m.sektor,
    m.entegrasyon_tipi,
    m.sorumlu,
    COALESCE(mp.aktif_faz_no, le.event_faz_no) AS aktif_faz_no,
    ft.asama_adi AS aktif_faz_adi,
    COALESCE(mp.durum, le.event_durum, 'Devam Ediyor'::public.faz_durum_enum) AS durum,
    COALESCE(mp.owner, le.event_owner, ft.owner) AS owner,
    COALESCE(mp.partner_owner, le.event_partner_owner) AS bekleyen_taraf,
    COALESCE(mp.hedef_tarihi, le.event_hedef_tarihi) AS hedef_tarihi,
    le.last_event_id,
    le.iteration_no,
    le.event_type AS son_event_type,
    le.son_aksiyon,
    le.event_baslangic_tarihi AS son_baslangic_tarihi,
    le.son_not,
    le.son_aktivite_tarihi
   FROM (((public.musteriler m
     LEFT JOIN public.musteri_pipeline mp ON ((mp.musteri_id = m.id)))
     LEFT JOIN latest_event le ON ((le.musteri_id = m.id)))
     LEFT JOIN public.faz_tanimlari ft ON ((ft.faz_no = COALESCE(mp.aktif_faz_no, le.event_faz_no))));


--
-- Name: vw_crm_timeline; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_crm_timeline AS
 SELECT pe.id AS event_id,
    pe.musteri_id,
    pe.faz_no,
    ft.asama_adi AS faz_adi,
    pe.iteration_no,
    pe.event_type,
    pe.durum,
    pe.aksiyon,
    pe.owner,
    pe.partner_owner,
    pe.baslangic_tarihi,
    pe.hedef_tarihi,
    pe.notlar,
    pe.created_at
   FROM (public.pipeline_eventleri pe
     LEFT JOIN public.faz_tanimlari ft ON ((ft.faz_no = pe.faz_no)));


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: import_teknik_aktiviteler id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_teknik_aktiviteler ALTER COLUMN id SET DEFAULT nextval('public.import_teknik_aktiviteler_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: allowed_users allowed_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allowed_users
    ADD CONSTRAINT allowed_users_email_key UNIQUE (email);


--
-- Name: allowed_users allowed_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allowed_users
    ADD CONSTRAINT allowed_users_pkey PRIMARY KEY (id);


--
-- Name: crm_audit_logs crm_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_audit_logs
    ADD CONSTRAINT crm_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: crm_forecast_blocker_history crm_forecast_blocker_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_forecast_blocker_history
    ADD CONSTRAINT crm_forecast_blocker_history_pkey PRIMARY KEY (id);


--
-- Name: crm_forecast_blockers crm_forecast_blockers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_forecast_blockers
    ADD CONSTRAINT crm_forecast_blockers_pkey PRIMARY KEY (id);


--
-- Name: crm_forecasts crm_forecasts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_forecasts
    ADD CONSTRAINT crm_forecasts_pkey PRIMARY KEY (id);


--
-- Name: crm_performance_snapshots crm_performance_snapshots_metric_id_scope_type_scope_id_per_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_performance_snapshots
    ADD CONSTRAINT crm_performance_snapshots_metric_id_scope_type_scope_id_per_key UNIQUE (metric_id, scope_type, scope_id, period_start, period_end);


--
-- Name: crm_performance_snapshots crm_performance_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_performance_snapshots
    ADD CONSTRAINT crm_performance_snapshots_pkey PRIMARY KEY (id);


--
-- Name: crm_permissions crm_permissions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_permissions
    ADD CONSTRAINT crm_permissions_code_key UNIQUE (code);


--
-- Name: crm_permissions crm_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_permissions
    ADD CONSTRAINT crm_permissions_pkey PRIMARY KEY (id);


--
-- Name: crm_role_permissions crm_role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_role_permissions
    ADD CONSTRAINT crm_role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: crm_roles crm_roles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_roles
    ADD CONSTRAINT crm_roles_code_key UNIQUE (code);


--
-- Name: crm_roles crm_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_roles
    ADD CONSTRAINT crm_roles_pkey PRIMARY KEY (id);


--
-- Name: crm_target_metrics crm_target_metrics_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_target_metrics
    ADD CONSTRAINT crm_target_metrics_code_key UNIQUE (code);


--
-- Name: crm_target_metrics crm_target_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_target_metrics
    ADD CONSTRAINT crm_target_metrics_pkey PRIMARY KEY (id);


--
-- Name: crm_target_revisions crm_target_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_target_revisions
    ADD CONSTRAINT crm_target_revisions_pkey PRIMARY KEY (id);


--
-- Name: crm_target_revisions crm_target_revisions_target_id_revision_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_target_revisions
    ADD CONSTRAINT crm_target_revisions_target_id_revision_no_key UNIQUE (target_id, revision_no);


--
-- Name: crm_targets crm_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_targets
    ADD CONSTRAINT crm_targets_pkey PRIMARY KEY (id);


--
-- Name: crm_team_members crm_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_team_members
    ADD CONSTRAINT crm_team_members_pkey PRIMARY KEY (team_id, user_id);


--
-- Name: crm_teams crm_teams_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_teams
    ADD CONSTRAINT crm_teams_code_key UNIQUE (code);


--
-- Name: crm_teams crm_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_teams
    ADD CONSTRAINT crm_teams_pkey PRIMARY KEY (id);


--
-- Name: crm_tv_devices crm_tv_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_tv_devices
    ADD CONSTRAINT crm_tv_devices_pkey PRIMARY KEY (id);


--
-- Name: crm_user_permission_overrides crm_user_permission_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_user_permission_overrides
    ADD CONSTRAINT crm_user_permission_overrides_pkey PRIMARY KEY (user_id, permission_id);


--
-- Name: crm_user_roles crm_user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_user_roles
    ADD CONSTRAINT crm_user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: faz_hareketleri faz_hareketleri_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faz_hareketleri
    ADD CONSTRAINT faz_hareketleri_pkey PRIMARY KEY (id);


--
-- Name: faz_tanimlari faz_tanimlari_faz_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faz_tanimlari
    ADD CONSTRAINT faz_tanimlari_faz_no_key UNIQUE (faz_no);


--
-- Name: faz_tanimlari faz_tanimlari_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faz_tanimlari
    ADD CONSTRAINT faz_tanimlari_pkey PRIMARY KEY (id);


--
-- Name: import_teknik_aktiviteler import_teknik_aktiviteler_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_teknik_aktiviteler
    ADD CONSTRAINT import_teknik_aktiviteler_pkey PRIMARY KEY (id);


--
-- Name: is_ortagi_faz_tanimlari is_ortagi_faz_tanimlari_faz_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.is_ortagi_faz_tanimlari
    ADD CONSTRAINT is_ortagi_faz_tanimlari_faz_no_key UNIQUE (faz_no);


--
-- Name: is_ortagi_faz_tanimlari is_ortagi_faz_tanimlari_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.is_ortagi_faz_tanimlari
    ADD CONSTRAINT is_ortagi_faz_tanimlari_pkey PRIMARY KEY (id);


--
-- Name: musteri_account_change_requests musteri_account_change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.musteri_account_change_requests
    ADD CONSTRAINT musteri_account_change_requests_pkey PRIMARY KEY (id);


--
-- Name: musteri_kunye musteri_kunye_musteri_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.musteri_kunye
    ADD CONSTRAINT musteri_kunye_musteri_id_key UNIQUE (musteri_id);


--
-- Name: musteri_kunye musteri_kunye_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.musteri_kunye
    ADD CONSTRAINT musteri_kunye_pkey PRIMARY KEY (id);


--
-- Name: musteri_kunye_v2 musteri_kunye_v2_musteri_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.musteri_kunye_v2
    ADD CONSTRAINT musteri_kunye_v2_musteri_id_key UNIQUE (musteri_id);


--
-- Name: musteri_kunye_v2 musteri_kunye_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.musteri_kunye_v2
    ADD CONSTRAINT musteri_kunye_v2_pkey PRIMARY KEY (id);


--
-- Name: musteri_pipeline musteri_pipeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.musteri_pipeline
    ADD CONSTRAINT musteri_pipeline_pkey PRIMARY KEY (musteri_id);


--
-- Name: musteriler musteriler_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.musteriler
    ADD CONSTRAINT musteriler_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- Name: pipeline_eventleri pipeline_eventleri_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_eventleri
    ADD CONSTRAINT pipeline_eventleri_pkey PRIMARY KEY (id);


--
-- Name: quote_items quote_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_pkey PRIMARY KEY (id);


--
-- Name: quote_items quote_items_quote_id_line_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_quote_id_line_no_key UNIQUE (quote_id, line_no);


--
-- Name: quote_pricing_rules quote_pricing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_pricing_rules
    ADD CONSTRAINT quote_pricing_rules_pkey PRIMARY KEY (id);


--
-- Name: quote_products quote_products_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_products
    ADD CONSTRAINT quote_products_code_key UNIQUE (code);


--
-- Name: quote_products quote_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_products
    ADD CONSTRAINT quote_products_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_quote_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_quote_no_key UNIQUE (quote_no);


--
-- Name: quotes quotes_quote_year_quote_serial_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_quote_year_quote_serial_key UNIQUE (quote_year, quote_serial);


--
-- Name: request_categories request_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_categories
    ADD CONSTRAINT request_categories_name_key UNIQUE (name);


--
-- Name: request_categories request_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_categories
    ADD CONSTRAINT request_categories_pkey PRIMARY KEY (id);


--
-- Name: request_events request_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_events
    ADD CONSTRAINT request_events_pkey PRIMARY KEY (id);


--
-- Name: requests requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_pkey PRIMARY KEY (id);


--
-- Name: system_parameters system_parameters_group_key_param_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_parameters
    ADD CONSTRAINT system_parameters_group_key_param_key_key UNIQUE (group_key, param_key);


--
-- Name: system_parameters system_parameters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_parameters
    ADD CONSTRAINT system_parameters_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_session_token_key UNIQUE (session_token);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


--
-- Name: crm_audit_logs_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_audit_logs_actor_idx ON public.crm_audit_logs USING btree (actor_user_id, created_at DESC);


--
-- Name: crm_audit_logs_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_audit_logs_entity_idx ON public.crm_audit_logs USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: crm_forecasts_owner_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_forecasts_owner_user_idx ON public.crm_forecasts USING btree (owner_user_id);


--
-- Name: crm_permission_overrides_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_permission_overrides_user_idx ON public.crm_user_permission_overrides USING btree (user_id);


--
-- Name: crm_targets_natural_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX crm_targets_natural_key ON public.crm_targets USING btree (metric_id, scope_type, COALESCE(scope_id, ''::text), period_type, start_date, end_date) WHERE (is_active = true);


--
-- Name: crm_targets_period_scope_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_targets_period_scope_idx ON public.crm_targets USING btree (start_date, end_date, scope_type, scope_id);


--
-- Name: crm_team_members_user_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_team_members_user_active_idx ON public.crm_team_members USING btree (user_id, is_active);


--
-- Name: crm_tv_devices_token_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX crm_tv_devices_token_hash_idx ON public.crm_tv_devices USING btree (device_token_hash) WHERE (device_token_hash IS NOT NULL);


--
-- Name: crm_user_roles_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_user_roles_user_idx ON public.crm_user_roles USING btree (user_id);


--
-- Name: idx_crm_forecast_blocker_history_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_forecast_blocker_history_customer ON public.crm_forecast_blocker_history USING btree (customer_id, changed_at DESC);


--
-- Name: idx_crm_forecast_blocker_history_forecast; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_forecast_blocker_history_forecast ON public.crm_forecast_blocker_history USING btree (forecast_id, changed_at DESC);


--
-- Name: idx_crm_forecast_blockers_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_forecast_blockers_due ON public.crm_forecast_blockers USING btree (resolution_due_date) WHERE (workflow_status = ANY (ARRAY['open'::text, 'in_progress'::text]));


--
-- Name: idx_crm_forecast_blockers_forecast; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_forecast_blockers_forecast ON public.crm_forecast_blockers USING btree (forecast_id) WHERE (forecast_id IS NOT NULL);


--
-- Name: idx_crm_forecast_blockers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_forecast_blockers_status ON public.crm_forecast_blockers USING btree (workflow_status, updated_at DESC);


--
-- Name: idx_crm_forecasts_customer_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_forecasts_customer_period ON public.crm_forecasts USING btree (customer_id, forecast_year, forecast_month) WHERE (is_active = true);


--
-- Name: idx_crm_forecasts_owner_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_forecasts_owner_period ON public.crm_forecasts USING btree (owner_name, forecast_year, forecast_month) WHERE (is_active = true);


--
-- Name: idx_faz_hareketleri_faz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faz_hareketleri_faz ON public.faz_hareketleri USING btree (faz_id);


--
-- Name: idx_faz_hareketleri_musteri; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faz_hareketleri_musteri ON public.faz_hareketleri USING btree (musteri_id);


--
-- Name: idx_is_ortagi_faz_tanimlari_active_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_is_ortagi_faz_tanimlari_active_sort ON public.is_ortagi_faz_tanimlari USING btree (is_active, sort_order, faz_no);


--
-- Name: idx_musteri_account_change_requests_musteri; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_musteri_account_change_requests_musteri ON public.musteri_account_change_requests USING btree (musteri_id, created_at DESC);


--
-- Name: idx_musteri_account_change_requests_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_musteri_account_change_requests_pending ON public.musteri_account_change_requests USING btree (musteri_id) WHERE (status = 'pending'::text);


--
-- Name: idx_musteri_account_change_requests_pending_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_musteri_account_change_requests_pending_unique ON public.musteri_account_change_requests USING btree (musteri_id) WHERE (status = 'pending'::text);


--
-- Name: idx_musteri_account_change_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_musteri_account_change_requests_status ON public.musteri_account_change_requests USING btree (status, created_at DESC);


--
-- Name: idx_musteri_kunye_musteri; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_musteri_kunye_musteri ON public.musteri_kunye USING btree (musteri_id);


--
-- Name: idx_musteri_kunye_v2_musteri_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_musteri_kunye_v2_musteri_id ON public.musteri_kunye_v2 USING btree (musteri_id);


--
-- Name: idx_musteri_pipeline_faz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_musteri_pipeline_faz ON public.musteri_pipeline USING btree (aktif_faz_no, updated_at DESC);


--
-- Name: idx_musteri_pipeline_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_musteri_pipeline_owner ON public.musteri_pipeline USING btree (owner);


--
-- Name: idx_musteriler_musteri_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_musteriler_musteri_lower ON public.musteriler USING btree (lower(musteri));


--
-- Name: idx_musteriler_owner_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_musteriler_owner_user_id ON public.musteriler USING btree (owner_user_id);


--
-- Name: idx_musteriler_sektor_enteg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_musteriler_sektor_enteg ON public.musteriler USING btree (sektor, entegrasyon_tipi);


--
-- Name: idx_musteriler_sorumlu; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_musteriler_sorumlu ON public.musteriler USING btree (sorumlu);


--
-- Name: idx_musteriler_sorumlu_sektor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_musteriler_sorumlu_sektor ON public.musteriler USING btree (sorumlu, sektor);


--
-- Name: idx_pipeline_event_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_event_created ON public.pipeline_eventleri USING btree (created_by);


--
-- Name: idx_pipeline_event_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_event_time ON public.pipeline_eventleri USING btree (created_at DESC);


--
-- Name: idx_pipeline_eventleri_activity_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_eventleri_activity_scope ON public.pipeline_eventleri USING btree (activity_scope);


--
-- Name: idx_pipeline_eventleri_affects_phase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_eventleri_affects_phase ON public.pipeline_eventleri USING btree (affects_phase);


--
-- Name: idx_pipeline_eventleri_blocked_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_eventleri_blocked_created ON public.pipeline_eventleri USING btree (is_blocked, created_at DESC);


--
-- Name: idx_pipeline_eventleri_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_eventleri_created_at ON public.pipeline_eventleri USING btree (created_at DESC);


--
-- Name: idx_pipeline_eventleri_created_by_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_eventleri_created_by_created ON public.pipeline_eventleri USING btree (created_by, created_at DESC);


--
-- Name: idx_pipeline_eventleri_durum_hedef; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_eventleri_durum_hedef ON public.pipeline_eventleri USING btree (durum, hedef_tarihi);


--
-- Name: idx_pipeline_eventleri_faz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_eventleri_faz ON public.pipeline_eventleri USING btree (faz_no);


--
-- Name: idx_pipeline_eventleri_faz_durum_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_eventleri_faz_durum_created ON public.pipeline_eventleri USING btree (faz_no, durum, created_at DESC);


--
-- Name: idx_pipeline_eventleri_hedef_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_eventleri_hedef_created ON public.pipeline_eventleri USING btree (hedef_tarihi, created_at DESC);


--
-- Name: idx_pipeline_eventleri_is_blocked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_eventleri_is_blocked ON public.pipeline_eventleri USING btree (is_blocked);


--
-- Name: idx_pipeline_eventleri_musteri_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_eventleri_musteri_created ON public.pipeline_eventleri USING btree (musteri_id, created_at DESC);


--
-- Name: idx_pipeline_eventleri_musteri_faz_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_eventleri_musteri_faz_created ON public.pipeline_eventleri USING btree (musteri_id, faz_no, created_at DESC);


--
-- Name: idx_pipeline_eventleri_musteri_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_eventleri_musteri_time ON public.pipeline_eventleri USING btree (musteri_id, created_at DESC);


--
-- Name: idx_pipeline_eventleri_partner_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_eventleri_partner_owner ON public.pipeline_eventleri USING btree (partner_owner);


--
-- Name: idx_quote_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_items_product ON public.quote_items USING btree (product_id);


--
-- Name: idx_quote_items_quote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_items_quote ON public.quote_items USING btree (quote_id, line_no);


--
-- Name: idx_quote_pricing_rules_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_pricing_rules_product ON public.quote_pricing_rules USING btree (product_id, min_qty);


--
-- Name: idx_quotes_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_customer ON public.quotes USING btree (customer_id, created_at DESC);


--
-- Name: idx_quotes_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_owner ON public.quotes USING btree (owner_name, created_at DESC);


--
-- Name: idx_quotes_quote_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_quote_no ON public.quotes USING btree (quote_no);


--
-- Name: idx_quotes_status_followup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_status_followup ON public.quotes USING btree (status, follow_up_date);


--
-- Name: idx_request_events_request_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_events_request_id_created_at ON public.request_events USING btree (request_id, created_at DESC);


--
-- Name: idx_requests_assignee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_assignee_id ON public.requests USING btree (assignee_id);


--
-- Name: idx_requests_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_category_id ON public.requests USING btree (category_id);


--
-- Name: idx_requests_created_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_created_at_desc ON public.requests USING btree (created_at DESC);


--
-- Name: idx_requests_due_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_due_at ON public.requests USING btree (due_at);


--
-- Name: idx_requests_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_priority ON public.requests USING btree (priority);


--
-- Name: idx_requests_requester_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_requester_id ON public.requests USING btree (requester_id);


--
-- Name: idx_requests_resolved_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_resolved_at ON public.requests USING btree (resolved_at);


--
-- Name: idx_requests_sla_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_sla_status ON public.requests USING btree (sla_status);


--
-- Name: idx_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_status ON public.requests USING btree (status);


--
-- Name: idx_requests_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_team_id ON public.requests USING btree (team_id);


--
-- Name: idx_system_parameters_group_active_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_parameters_group_active_sort ON public.system_parameters USING btree (group_key, is_active, sort_order, label);


--
-- Name: idx_user_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_token ON public.user_sessions USING btree (session_token);


--
-- Name: idx_user_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- Name: musteriler_owner_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX musteriler_owner_user_idx ON public.musteriler USING btree (owner_user_id);


--
-- Name: password_reset_tokens_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX password_reset_tokens_expiry_idx ON public.password_reset_tokens USING btree (expires_at) WHERE (used_at IS NULL);


--
-- Name: password_reset_tokens_user_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX password_reset_tokens_user_active_idx ON public.password_reset_tokens USING btree (user_id, expires_at DESC) WHERE (used_at IS NULL);


--
-- Name: pipeline_eventleri_owner_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pipeline_eventleri_owner_user_idx ON public.pipeline_eventleri USING btree (owner_user_id);


--
-- Name: quotes_owner_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quotes_owner_user_idx ON public.quotes USING btree (owner_user_id);


--
-- Name: ux_crm_forecast_blockers_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_crm_forecast_blockers_customer ON public.crm_forecast_blockers USING btree (customer_id);


--
-- Name: ux_teams_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_teams_name ON public.teams USING btree (name);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_key ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: crm_forecast_blockers crm_forecast_blockers_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER crm_forecast_blockers_history AFTER INSERT OR DELETE OR UPDATE ON public.crm_forecast_blockers FOR EACH ROW EXECUTE FUNCTION public.log_crm_forecast_blocker_history();


--
-- Name: crm_forecast_blockers crm_forecast_blockers_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER crm_forecast_blockers_touch_updated_at BEFORE UPDATE ON public.crm_forecast_blockers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: crm_forecasts crm_forecasts_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER crm_forecasts_touch_updated_at BEFORE UPDATE ON public.crm_forecasts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: quote_products quote_products_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quote_products_touch_updated_at BEFORE UPDATE ON public.quote_products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: quotes quotes_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quotes_touch_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: pipeline_eventleri trg_pipeline_eventleri_sync_musteri_pipeline; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pipeline_eventleri_sync_musteri_pipeline AFTER INSERT OR DELETE OR UPDATE ON public.pipeline_eventleri FOR EACH ROW EXECUTE FUNCTION public.trg_sync_musteri_pipeline();


--
-- Name: requests trg_requests_sla_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_requests_sla_status BEFORE INSERT OR UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.compute_requests_sla_status();


--
-- Name: requests trg_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_requests_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.set_requests_updated_at();


--
-- Name: musteri_kunye trg_update_kunye_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_kunye_updated_at BEFORE UPDATE ON public.musteri_kunye FOR EACH ROW EXECUTE FUNCTION public.update_kunye_updated_at();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: crm_forecast_blockers crm_forecast_blockers_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_forecast_blockers
    ADD CONSTRAINT crm_forecast_blockers_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.musteriler(id) ON DELETE CASCADE;


--
-- Name: crm_forecast_blockers crm_forecast_blockers_forecast_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_forecast_blockers
    ADD CONSTRAINT crm_forecast_blockers_forecast_id_fkey FOREIGN KEY (forecast_id) REFERENCES public.crm_forecasts(id) ON DELETE SET NULL;


--
-- Name: crm_forecasts crm_forecasts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_forecasts
    ADD CONSTRAINT crm_forecasts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.musteriler(id) ON DELETE CASCADE;


--
-- Name: crm_performance_snapshots crm_performance_snapshots_metric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_performance_snapshots
    ADD CONSTRAINT crm_performance_snapshots_metric_id_fkey FOREIGN KEY (metric_id) REFERENCES public.crm_target_metrics(id);


--
-- Name: crm_role_permissions crm_role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_role_permissions
    ADD CONSTRAINT crm_role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.crm_permissions(id) ON DELETE CASCADE;


--
-- Name: crm_role_permissions crm_role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_role_permissions
    ADD CONSTRAINT crm_role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.crm_roles(id) ON DELETE CASCADE;


--
-- Name: crm_target_revisions crm_target_revisions_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_target_revisions
    ADD CONSTRAINT crm_target_revisions_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.crm_targets(id) ON DELETE CASCADE;


--
-- Name: crm_targets crm_targets_metric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_targets
    ADD CONSTRAINT crm_targets_metric_id_fkey FOREIGN KEY (metric_id) REFERENCES public.crm_target_metrics(id);


--
-- Name: crm_team_members crm_team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_team_members
    ADD CONSTRAINT crm_team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.crm_teams(id) ON DELETE CASCADE;


--
-- Name: crm_user_permission_overrides crm_user_permission_overrides_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_user_permission_overrides
    ADD CONSTRAINT crm_user_permission_overrides_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.crm_permissions(id) ON DELETE CASCADE;


--
-- Name: crm_user_roles crm_user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_user_roles
    ADD CONSTRAINT crm_user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.crm_roles(id) ON DELETE CASCADE;


--
-- Name: faz_hareketleri faz_hareketleri_faz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faz_hareketleri
    ADD CONSTRAINT faz_hareketleri_faz_id_fkey FOREIGN KEY (faz_id) REFERENCES public.faz_tanimlari(id);


--
-- Name: faz_hareketleri faz_hareketleri_musteri_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faz_hareketleri
    ADD CONSTRAINT faz_hareketleri_musteri_id_fkey FOREIGN KEY (musteri_id) REFERENCES public.musteriler(id) ON DELETE CASCADE;


--
-- Name: musteri_kunye fk_kunye_musteri; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.musteri_kunye
    ADD CONSTRAINT fk_kunye_musteri FOREIGN KEY (musteri_id) REFERENCES public.musteriler(id) ON DELETE CASCADE;


--
-- Name: musteri_account_change_requests musteri_account_change_requests_musteri_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.musteri_account_change_requests
    ADD CONSTRAINT musteri_account_change_requests_musteri_id_fkey FOREIGN KEY (musteri_id) REFERENCES public.musteriler(id) ON DELETE CASCADE;


--
-- Name: musteri_kunye_v2 musteri_kunye_v2_musteri_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.musteri_kunye_v2
    ADD CONSTRAINT musteri_kunye_v2_musteri_id_fkey FOREIGN KEY (musteri_id) REFERENCES public.musteriler(id) ON DELETE CASCADE;


--
-- Name: musteri_pipeline musteri_pipeline_aktif_faz_no_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.musteri_pipeline
    ADD CONSTRAINT musteri_pipeline_aktif_faz_no_fkey FOREIGN KEY (aktif_faz_no) REFERENCES public.faz_tanimlari(faz_no);


--
-- Name: musteri_pipeline musteri_pipeline_musteri_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.musteri_pipeline
    ADD CONSTRAINT musteri_pipeline_musteri_id_fkey FOREIGN KEY (musteri_id) REFERENCES public.musteriler(id) ON DELETE CASCADE;


--
-- Name: musteriler musteriler_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.musteriler
    ADD CONSTRAINT musteriler_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.allowed_users(id) ON DELETE SET NULL;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.allowed_users(id) ON DELETE CASCADE;


--
-- Name: pipeline_eventleri pipeline_eventleri_faz_no_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_eventleri
    ADD CONSTRAINT pipeline_eventleri_faz_no_fkey FOREIGN KEY (faz_no) REFERENCES public.faz_tanimlari(faz_no);


--
-- Name: pipeline_eventleri pipeline_eventleri_musteri_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_eventleri
    ADD CONSTRAINT pipeline_eventleri_musteri_id_fkey FOREIGN KEY (musteri_id) REFERENCES public.musteriler(id) ON DELETE CASCADE;


--
-- Name: quote_items quote_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.quote_products(id);


--
-- Name: quote_items quote_items_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quote_pricing_rules quote_pricing_rules_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_pricing_rules
    ADD CONSTRAINT quote_pricing_rules_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.quote_products(id) ON DELETE CASCADE;


--
-- Name: quotes quotes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.musteriler(id) ON DELETE CASCADE;


--
-- Name: request_categories request_categories_default_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_categories
    ADD CONSTRAINT request_categories_default_team_id_fkey FOREIGN KEY (default_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: request_events request_events_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_events
    ADD CONSTRAINT request_events_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;


--
-- Name: requests requests_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.request_categories(id) ON DELETE SET NULL;


--
-- Name: requests requests_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.allowed_users(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: allowed_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;

--
-- Name: allowed_users allowed_users_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allowed_users_select_self ON public.allowed_users FOR SELECT TO authenticated USING ((email = (auth.jwt() ->> 'email'::text)));


--
-- Name: faz_tanimlari anon read faz; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anon read faz" ON public.faz_tanimlari FOR SELECT TO anon USING (true);


--
-- Name: musteriler anon read musteri; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anon read musteri" ON public.musteriler FOR SELECT TO anon USING (true);


--
-- Name: musteri_pipeline anon read pipeline; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anon read pipeline" ON public.musteri_pipeline FOR SELECT TO anon USING (true);


--
-- Name: pipeline_eventleri anon_insert_event; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_insert_event ON public.pipeline_eventleri FOR INSERT TO anon WITH CHECK (true);


--
-- Name: faz_tanimlari anon_read_faz; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_read_faz ON public.faz_tanimlari FOR SELECT TO anon USING (true);


--
-- Name: musteriler anon_read_musteriler; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_read_musteriler ON public.musteriler FOR SELECT TO anon USING (true);


--
-- Name: musteri_pipeline anon_read_pipeline; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_read_pipeline ON public.musteri_pipeline FOR SELECT TO anon USING (true);


--
-- Name: musteri_pipeline anon_update_pipeline; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_update_pipeline ON public.musteri_pipeline FOR UPDATE TO anon USING (true) WITH CHECK (true);


--
-- Name: crm_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_forecast_blocker_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_forecast_blocker_history ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_forecast_blockers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_forecast_blockers ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_forecasts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_forecasts ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_performance_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_performance_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_target_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_target_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_target_revisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_target_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_targets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_targets ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_teams ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_tv_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_tv_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_user_permission_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_user_permission_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: faz_hareketleri; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.faz_hareketleri ENABLE ROW LEVEL SECURITY;

--
-- Name: faz_tanimlari; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.faz_tanimlari ENABLE ROW LEVEL SECURITY;

--
-- Name: import_teknik_aktiviteler; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.import_teknik_aktiviteler ENABLE ROW LEVEL SECURITY;

--
-- Name: is_ortagi_faz_tanimlari; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.is_ortagi_faz_tanimlari ENABLE ROW LEVEL SECURITY;

--
-- Name: musteri_account_change_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.musteri_account_change_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: musteri_kunye; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.musteri_kunye ENABLE ROW LEVEL SECURITY;

--
-- Name: musteri_kunye_v2; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.musteri_kunye_v2 ENABLE ROW LEVEL SECURITY;

--
-- Name: musteri_pipeline; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.musteri_pipeline ENABLE ROW LEVEL SECURITY;

--
-- Name: musteriler; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.musteriler ENABLE ROW LEVEL SECURITY;

--
-- Name: password_reset_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_eventleri; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pipeline_eventleri ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_eventleri pipeline_eventleri_insert_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pipeline_eventleri_insert_authenticated ON public.pipeline_eventleri FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: quote_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_pricing_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_pricing_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_products ENABLE ROW LEVEL SECURITY;

--
-- Name: quotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: request_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.request_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: request_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.request_events ENABLE ROW LEVEL SECURITY;

--
-- Name: requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

--
-- Name: system_parameters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_parameters ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: user_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: ensure_rls; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
         WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
   EXECUTE FUNCTION public.rls_auto_enable();


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

\unrestrict iZCJnYWWOMt7UwzjoCtB3OgGdzMNsyIcHxBF4UIBRFj8CGNgRjH6ox0ev9IRa8i

