(ns contentengine.app-test
  (:require [cljs.test :refer [deftest is testing]]
            [contentengine.app :as app]))

;; ---------------------------------------------------------------------------
;; pure helpers — ports of the +page.svelte template's inline expressions
;; ---------------------------------------------------------------------------

(deftest xrpc-label-test
  (testing "`{app.xrpc ? 'enabled' : 'not configured'}`"
    (is (= "enabled" (app/xrpc-label true)))
    (is (= "not configured" (app/xrpc-label false)))
    (is (= "not configured" (app/xrpc-label nil)))))

(deftest has-routes?-test
  (testing "`{#if app.routes.length}`"
    (is (false? (app/has-routes? [])))
    (is (false? (app/has-routes? nil)))
    (is (true? (app/has-routes? ["/xrpc/com.example.cap"])))))

(deftest has-vars?-test
  (testing "`{#if app.vars.length}`"
    (is (false? (app/has-vars? [])))
    (is (false? (app/has-vars? nil)))
    (is (true? (app/has-vars? ["APP_NANOID"])))))

;; ---------------------------------------------------------------------------
;; default-app — must match the Svelte scaffold's inline `const app = {...}`
;; field-for-field, including the already-stale relative-path (see app.cljs
;; ns docstring: ported verbatim, not corrected).
;; ---------------------------------------------------------------------------

(deftest default-app-test
  (testing "ports every field of the original +page.svelte `const app`"
    (is (= "Contentengine Cten0001" (:title app/default-app)))
    (is (= "etzhayyim-project-contentengine" (:project app/default-app)))
    (is (= "contentengine-cten0001" (:name app/default-app)))
    (is (= "appview" (:kind app/default-app)))
    (is (= 0 (:route-count app/default-app)))
    (is (= [] (:routes app/default-app)))
    (is (= [] (:vars app/default-app)))
    (is (true? (:xrpc? app/default-app)))
    (is (= "60-apps/etzhayyim-project-contentengine/appview/contentengine-cten0001/svelte/src/routes/+page.svelte"
           (:relative-path app/default-app)))))

;; ---------------------------------------------------------------------------
;; re-frame handlers — tested as plain functions (no app-db / re-frame
;; runtime needed: reg-event-db/reg-sub just register these).
;; ---------------------------------------------------------------------------

(deftest initialize-db-test
  (testing "`:initialize-db` seeds the db with default-app regardless of prior db"
    (is (= app/default-app (app/initialize-db {} [:initialize-db])))
    (is (= app/default-app (app/initialize-db {:stale "whatever"} [:initialize-db])))))

(deftest app-query-test
  (testing "`:app` sub is the identity projection of the whole db"
    (is (= app/default-app (app/app-query app/default-app [:app])))
    (is (= {:a 1} (app/app-query {:a 1} [:app])))))
