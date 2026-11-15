import argparse
import os
from pathlib import Path
from .io import HttpClient, read_json, write_json, ApiError
from .pipeline import build
from .programs import fetch_trials, keenable_search
from .paperclip import Paperclip
from .screen import Ptarmigan
from .admet import Tamarind, import_admet
from .evidence import codependencies,panel_membership
from .score import score_all

ROOT=Path(__file__).resolve().parents[1]


def main():
    parser=argparse.ArgumentParser(description='KIT/GIST report-first evidence and screening workbench')
    sub=parser.add_subparsers(dest='command',required=True)
    p=sub.add_parser('build',help='Build a self-contained report, rubric and checked sequence panel')
    p.add_argument('--out',default=str(ROOT/'build'))
    p.add_argument('--evidence-dir',default=str(ROOT/'evidence'))
    p.add_argument('--as-of',help='YYYY-MM-DD publication cutoff; excludes current registry snapshots')
    p.add_argument('--report-date',help='User-local date for the report label')
    p.add_argument('--bundle');p.add_argument('--compounds')
    p=sub.add_parser('fetch-trials',help='Explicit public-registry fallback / cross-check')
    p.add_argument('--out',default=str(ROOT/'evidence/trials.json'));p.add_argument('--pages',type=int,default=2)
    p=sub.add_parser('paperclip',help='Primary trial, literature and PK/PD discovery')
    p.add_argument('--out',default=str(ROOT/'evidence/paperclip/retrieval.json'));p.add_argument('--as-of')
    p=sub.add_parser('paperclip-read',help='Read a line-numbered full-text primary source')
    p.add_argument('pmcid');p.add_argument('--out',required=True)
    p=sub.add_parser('keenable');p.add_argument('query');p.add_argument('--out',required=True);p.add_argument('--as-of')
    p=sub.add_parser('ptarmigan-inspect');p.add_argument('--out',required=True)
    p=sub.add_parser('estimate');p.add_argument('--protein-id',required=True);p.add_argument('--collection-id',required=True);p.add_argument('--out',required=True)
    p=sub.add_parser('screen',help='Submit a cost-approved screen using a durable idempotency key')
    p.add_argument('--protein-id',required=True);p.add_argument('--collection-id',required=True)
    p.add_argument('--max-cost-usd',required=True);p.add_argument('--state',required=True)
    p=sub.add_parser('screen-status');p.add_argument('screen_id');p.add_argument('--out',required=True);p.add_argument('--include-hits',action='store_true')
    p=sub.add_parser('admet-plan',help='Account-scoped tool discovery and free validation')
    p.add_argument('--compounds',required=True);p.add_argument('--job-name',required=True);p.add_argument('--out',required=True)
    p=sub.add_parser('admet-submit',help='Explicitly consume a Tamarind job for a validated plan')
    p.add_argument('--plan',required=True);p.add_argument('--out',required=True)
    p=sub.add_parser('admet-import');p.add_argument('--csv',required=True);p.add_argument('--compounds',required=True);p.add_argument('--source',required=True);p.add_argument('--out',required=True)
    p=sub.add_parser('depmap');p.add_argument('--csv',required=True);p.add_argument('--target',default='KIT');p.add_argument('--min-pairs',type=int,default=30);p.add_argument('--out',required=True);p.add_argument('--model-ids',help='One selected model ID per line; e.g. a reviewed GIST cohort')
    p=sub.add_parser('ppa');p.add_argument('--csv',required=True);p.add_argument('--uniprot',default='P10721');p.add_argument('--complete-table',action='store_true');p.add_argument('--out',required=True)
    p=sub.add_parser('score');p.add_argument('--compounds',required=True);p.add_argument('--rubric',required=True);p.add_argument('--out',required=True)
    args=parser.parse_args();http=HttpClient(ROOT/'cache')
    try:
        if args.command=='build':
            report=build(args.out,args.evidence_dir,args.as_of,args.report_date,args.bundle,args.compounds)
            print(f"Built {Path(args.out).resolve() / 'report.html'} ({len(report['evidence'])} sources, {len(report['rubric']['criteria'])} criteria)")
            return
        elif args.command=='fetch-trials':result=fetch_trials(http,args.pages)
        elif args.command=='paperclip':result=Paperclip(http).target_evidence(args.as_of)
        elif args.command=='paperclip-read':result=Paperclip(http).fulltext(args.pmcid)
        elif args.command=='keenable':
            key=os.environ.get('KEENABLE_API_KEY')
            if not key:raise ValueError('Set KEENABLE_API_KEY')
            result=keenable_search(http,key,args.query,args.as_of)
        elif args.command=='ptarmigan-inspect':result=Ptarmigan(http).inspect()
        elif args.command=='estimate':result=Ptarmigan(http).estimate(args.protein_id,args.collection_id)
        elif args.command=='screen':
            result=Ptarmigan(http).submit(args.protein_id,args.collection_id,args.max_cost_usd,args.state)
            print('Screen response saved in '+args.state)
            return
        elif args.command=='screen-status':
            client=Ptarmigan(http);result=client.status(args.screen_id)
            if args.include_hits and result.get('status')=='completed':result['hits']=client.hits(args.screen_id)
        elif args.command=='admet-plan':
            compounds=read_json(args.compounds);client=Tamarind(http)
            payload=client.admet_payload([c['smiles'] for c in compounds],args.job_name)
            result={'payload':payload,'validation':client.validate(payload)}
        elif args.command=='admet-submit':result=Tamarind(http).submit(read_json(args.plan)['payload'])
        elif args.command=='admet-import':
            compounds=read_json(args.compounds)
            result=import_admet(args.csv,{c['smiles']:c for c in compounds},args.source)
        elif args.command=='depmap':
            ids=set(Path(args.model_ids).read_text().splitlines()) if args.model_ids else None
            result=codependencies(args.csv,args.target,args.min_pairs,model_ids=ids)
        elif args.command=='ppa':result=panel_membership(args.csv,args.uniprot,args.complete_table)
        elif args.command=='score':result=score_all(read_json(args.compounds),read_json(args.rubric))
        write_json(args.out,result);print('Saved '+args.out)
    except (ApiError,ValueError,KeyError,OSError) as exc:
        parser.exit(1,f'{type(exc).__name__}: {exc}\n')


if __name__=='__main__':main()
