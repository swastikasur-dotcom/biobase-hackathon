"""Report-first assembly. Live discovery never silently becomes curated fact."""
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from .io import read_json, write_json, utcnow
from .failures import filter_evidence
from .rubric import derive_rubric
from .score import score_all
from .sequences import make_panel, fasta
from .pkpd import validate_pkpd
from .report import render

DATA=Path(__file__).parent/'data'


def optional(path, default=None):
    return read_json(path) if Path(path).exists() else default


def build(output, evidence_dir, as_of=None, report_date=None, bundle_path=None, compounds_path=None):
    bundle=read_json(bundle_path or DATA/'kit_gist.json')
    evidence, excluded=filter_evidence(bundle,as_of)
    rubric=derive_rubric(bundle,evidence,as_of)
    ids={e['id'] for e in evidence}
    sequence=read_json(DATA/'kit_sequence.json')
    panel=make_panel(sequence['sequence'],bundle['mutations'],ids)
    evidence_dir=Path(evidence_dir)
    current=as_of is None
    trials=optional(evidence_dir/'trials.json') if current else None
    names=optional(evidence_dir/'names.json',[]) if current else []
    compounds=read_json(compounds_path) if compounds_path else (optional(evidence_dir/'controls.json',[]) if current else [])
    screen=optional(evidence_dir/'screen.json',{}) if current else {}
    screen['plan']=optional(evidence_dir/'ptarmigan_plan.json',{}) if current else {}
    if screen.get('hits'):
        screen['total_hits']=len(screen['hits'])
        screen['hits']=screen['hits'][:25]
    scores=score_all(compounds,rubric)
    pkpd=validate_pkpd(bundle.get('pkpd',[]),evidence)
    paperclip_dir=evidence_dir/'paperclip'
    paperclip_hits=sum(len(optional(paperclip_dir/(name+'.json'),{}).get('response',{}).get('results',[])) for name in ['trials','failures','pkpd']) if current else 0
    admet_summary=optional(evidence_dir/'full_admet_summary.json',{}) if current else {}
    integrations=[
      {'name':'Paperclip','status':'live' if paperclip_hits else 'not retrieved',
       'detail':f'{paperclip_hits} search results across trials, resistance literature and PK/PD. Primary source passages checked separately.' if paperclip_hits else 'Set PAPERCLIP_API_KEY and retrieve evidence.'},
      {'name':'Keenable','status':'live' if current and (evidence_dir/'keenable_programs.json').exists() else 'not retrieved','detail':'Current-program search leads are labeled unreviewed until source curation.'},
      {'name':'NCATS','status':'live' if names else 'not retrieved','detail':f'{len(names)} exact-name lookups. Parent and salt identities are not silently merged.'},
      {'name':'Ptarmigan','status':'live' if screen.get('plan',{}).get('proteins') else 'not retrieved','detail':'Catalog KIT available; custom mutants unsupported. Screen execution and model metadata are tracked separately.'},
      {'name':'Tamarind','status':'live' if admet_summary.get('status')=='complete' else 'result pending','detail':str(admet_summary.get('predicted_compounds',0))+' compound predictions matched by structure and library ID. Missing mutant and off-target requirements remain separate.'},
      {'name':'DepMap','status':'data pending','detail':'CSV co-dependency analysis implemented. No dependency dataset or GIST cohort is loaded, so no combination candidates are asserted.'},
      {'name':'Plasma atlas','status':'membership unknown','detail':'Complete assay table required for a negative result. No KIT plasma association or assay absence is inferred.'},
      {'name':'Genomic Intelligence','status':'interface only','detail':'Deferred for the coding-resistance focus. No regulatory or splice predictions are fabricated.'},
    ]
    # Cutoffs filter the exported bundle too, not just visible HTML.
    visible=deepcopy(bundle)
    visible['evidence']=evidence
    visible['criteria']=rubric['all_criteria']
    visible['mutations']=[m for m in bundle['mutations'] if set(m['evidence'])<=ids]
    visible['programs']=[p for p in bundle['programs'] if set(p['evidence'])<=ids]
    visible['pkpd']=pkpd
    if visible.get('activity_matrix',{}).get('source_id') not in ids:
        visible.pop('activity_matrix',None)
    if not current:
        integrations=[{'name':i['name'],'status':'excluded from historical view','detail':'Current retrieval snapshots are not used to reconstruct historical knowledge.'} for i in integrations]
    report={'schema_version':'1.0','generated_at':utcnow(),
            'report_date':report_date or datetime.now().date().isoformat(),
            'bundle':visible,'evidence':evidence,'excluded_evidence':excluded,'rubric':rubric,
            'sequence_reference':{k:v for k,v in sequence.items() if k!='sequence'},
            'trials':trials,'names':names,'pkpd':pkpd,'scores':scores,'screen':screen,
            'keenable':optional(evidence_dir/'keenable_programs.json') if current else None,
            'admet_endpoints':read_json(DATA/'admet_endpoints.json') if current else [],
            'integrations':integrations}
    output=Path(output);output.mkdir(exist_ok=True,parents=True)
    write_json(output/'rubric.json',rubric)
    write_json(output/'report.json',report)
    write_json(output/'scores.json',scores)
    write_json(output/'sequence_panel.json',panel)
    (output/'sequence_panel.fasta').write_text(fasta(panel),encoding='utf-8')
    render(report,output/'report.html')
    return report
