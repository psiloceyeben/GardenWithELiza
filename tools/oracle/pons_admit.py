#!/usr/bin/env python3
"""Admit the Pons Garden lore corpus into a copy of an Oracle7 build (the HOODBarons recipe, reconstructed).

    python3 pons_admit.py --base <build_dir> --out <build_dir> --corpus pons_lore_d1.jsonl [--stamp pons_lore_2026_09_07]

Schema (oracle-stage5m13b-wikipedia-sqlite-v3): article, title_alias, page_sentence, source_rows (fts5), metadata.
Admission law: a sentence is admitted only if it has 4-60 words; rejected sentences are dropped, never repaired.
A corpus article whose normalized title already exists is MERGED (new sentences appended, aliases added);
otherwise it becomes a new Fable page fb<N> (N continues from the highest existing fb id). Every Fable claim id
names its kind (fable_<stamp>_<slug>_<ordinal>) so citations stay honest about their source.
"""
import argparse, hashlib, json, os, re, shutil, sqlite3, sys, time

def norm(t):
    return re.sub(r"\s+", " ", t.strip().lower())

def slug(t):
    return re.sub(r"[^a-z0-9]+", "_", t.lower()).strip("_")

def sha(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True); ap.add_argument("--out", required=True); ap.add_argument("--corpus", required=True)
    ap.add_argument("--stamp", default="pons_lore_" + time.strftime("%Y_%m_%d")); ap.add_argument("--min-words", type=int, default=4); ap.add_argument("--max-words", type=int, default=60)
    a = ap.parse_args()
    if not os.path.exists(a.out):
        print(f"copying base build {a.base} -> {a.out}"); shutil.copytree(a.base, a.out)
        for junk in ("wikipedia_specialist.sqlite3-shm", "wikipedia_specialist.sqlite3-wal"):
            p = os.path.join(a.out, junk)
            if os.path.exists(p): os.remove(p)
    db = os.path.join(a.out, "wikipedia_specialist.sqlite3")
    c = sqlite3.connect(db); c.execute("PRAGMA journal_mode=WAL")
    fb_max = 0
    for (pid,) in c.execute("select page_id from article where page_id like 'fb%'"):
        try: fb_max = max(fb_max, int(pid[2:]))
        except ValueError: pass
    report = {"admitted": 0, "rejected": 0, "articles": {}, "stamp": a.stamp}
    with open(a.corpus, encoding="utf-8") as fh:
        arts = [json.loads(l) for l in fh if l.strip()]
    for art in arts:
        title = art["title"]; nt = norm(title); s = slug(title)
        row = c.execute("select page_id, sentence_count, admitted_sentence_count from article where normalized_title=?", (nt,)).fetchone()
        if row: pid, mode, prior = row[0], "merged_into", row[2] or 0
        else:
            fb_max += 1; pid, mode, prior = f"fb{fb_max}", "new_page", 0
            refs = ["fable_synthesis"] + list(art.get("references", []))
            c.execute("insert into article(page_id,title,normalized_title,canonical_url,raw_record_sha256,abstract_sha256,categories_json,sentence_count,admitted_sentence_count) values(?,?,?,?,?,?,?,?,?)",
                      (pid, title, nt, f"fable://{a.stamp}/{s}", sha(json.dumps(art, sort_keys=True)), sha(art["sentences"][0] if art["sentences"] else ""), json.dumps(refs), 0, 0))
            c.execute("insert into title_alias(normalized_title,page_id) values(?,?)", (nt, pid))
        aliases_added = []
        for al in art.get("aliases", []):
            na = norm(al)
            if not c.execute("select 1 from title_alias where normalized_title=? and page_id=?", (na, pid)).fetchone():
                c.execute("insert into title_alias(normalized_title,page_id) values(?,?)", (na, pid)); aliases_added.append(na)
        ordinal = (c.execute("select coalesce(max(sentence_ordinal),-1) from page_sentence where page_id=?", (pid,)).fetchone()[0] or -1) + 1
        adm = rej = 0
        for sent in art["sentences"]:
            sent = re.sub(r"\s+", " ", sent.strip()); n = len(sent.split())
            if n < a.min_words or n > a.max_words: rej += 1; continue
            if c.execute("select 1 from source_rows where page_id=? and fact_sha256=?", (pid, sha(sent))).fetchone(): continue
            cur = c.execute("insert into source_rows(claim_id,fact,fact_sha256,page_id,sentence_ordinal) values(?,?,?,?,?)", (f"fable_{a.stamp}_{s}_{ordinal}", sent, sha(sent), pid, str(ordinal)))
            c.execute("insert into page_sentence(page_id,sentence_ordinal,source_rowid) values(?,?,?)", (pid, ordinal, cur.lastrowid))
            ordinal += 1; adm += 1
        c.execute("update article set sentence_count=?, admitted_sentence_count=? where page_id=?", (ordinal, ordinal, pid))
        report["admitted"] += adm; report["rejected"] += rej
        report["articles"][title] = {"page_id": pid, "mode": mode, "admitted": adm, "rejected": rej, "prior_admitted": prior, "aliases_added": aliases_added}
    # fable_first lead: on merged pages the game's own sentences come first, so the head answers in-world before the encyclopedia
    for (pid,) in c.execute("select distinct page_id from source_rows where claim_id like 'fable_%'").fetchall():
        rows = c.execute("select ps.sentence_ordinal, ps.source_rowid, sr.claim_id from page_sentence ps join source_rows sr on sr.rowid = ps.source_rowid where ps.page_id=? order by ps.sentence_ordinal", (pid,)).fetchall()
        fab = [r for r in rows if r[2].startswith("fable_")]; rest = [r for r in rows if not r[2].startswith("fable_")]
        if not fab or rows[: len(fab)] == fab: continue
        for i, (_, rowid, _) in enumerate(fab + rest):
            c.execute("update page_sentence set sentence_ordinal=? where page_id=? and source_rowid=?", (i, pid, rowid))
            c.execute("update source_rows set sentence_ordinal=? where rowid=?", (str(i), rowid))
    for k, q in (("articles", "select count(*) from article"), ("admitted_articles", "select count(*) from article"), ("claims", "select count(*) from source_rows"), ("page_sentence_addresses", "select count(*) from page_sentence"), ("unique_titles", "select count(distinct normalized_title) from article")):
        c.execute("insert or replace into metadata(key,value) values(?,?)", (k, str(c.execute(q).fetchone()[0])))
    c.commit(); c.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    metrics = {k: json.loads(v) for k, v in c.execute("select key, value from metadata")}
    c.close()
    with open(os.path.join(a.out, f"{a.stamp}_admission_report.json"), "w") as fh: json.dump(report, fh, indent=1, sort_keys=True)
    mp = os.path.join(a.out, "manifest.json")
    if os.path.exists(mp):
        # validate_build (stage5m13b) requires manifest.metrics == sqlite metadata and the registered byte size to match;
        # the sqlite sha is only checked on deep validation, so it is recomputed here for honesty.
        m = json.load(open(mp)); m.setdefault("fable_admissions", []).append({"stamp": a.stamp, "corpus": os.path.basename(a.corpus), "admitted": report["admitted"], "rejected": report["rejected"], "articles": len(arts)})
        m["metrics"] = metrics
        h = hashlib.sha256()
        with open(db, "rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b""): h.update(chunk)
        m["files"] = {"wikipedia_specialist.sqlite3": {"bytes": os.path.getsize(db), "sha256": h.hexdigest()}}
        json.dump(m, open(mp, "w"), indent=2)
    print(f"admitted {report['admitted']} sentences, rejected {report['rejected']}, articles {len(arts)} (new fb up to fb{fb_max}) -> {a.out}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
