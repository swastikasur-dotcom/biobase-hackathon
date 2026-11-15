"""Offline, self-contained research report; all source text is HTML escaped."""
import html
import json
from pathlib import Path
from urllib.parse import urlsplit


def esc(value):
    return html.escape('' if value is None else str(value), quote=True)


def external(url, label):
    if urlsplit(str(url)).scheme not in {'https','http'}:
        return esc(label)
    return f'<a href="{esc(url)}" target="_blank" rel="noopener noreferrer">{esc(label)} ↗</a>'


def refs(ids):
    return ' '.join(f'<a class="ref" href="#{esc(i)}">{esc(i)}</a>' for i in ids)


def table(headers, rows, classes=''):
    return '<div class="table-wrap"><table class="'+classes+'"><thead><tr>'+''.join('<th>'+esc(h)+'</th>' for h in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+c+'</td>' for c in row)+'</tr>' for row in rows)+'</tbody></table></div>'


def render(report, destination):
    bundle, rubric = report['bundle'], report['rubric']
    evidence = report['evidence']
    evidence_ids = {e['id'] for e in evidence}
    mutations = [m for m in bundle['mutations'] if set(m['evidence']) <= evidence_ids]
    programs = [p for p in bundle['programs'] if set(p['evidence']) <= evidence_ids]
    sections = {}
    sections['mutations'] = ''.join(
        '<button class="mutation" type="button" data-exon="'+str(m['exon'])+'"><small>EXON '+str(m['exon'])+'</small><strong>'+esc(m['variant'])+'</strong><span>'+esc(m['region'])+'</span></button>' for m in mutations)
    matrix = bundle.get('activity_matrix', {})
    if matrix.get('source_id') in evidence_ids:
        rows=[]
        for row in matrix['rows']:
            cells=[esc(row['genotype'])+'<small class="sub">'+esc(row['model'])+'</small>']
            for val in row['values']:
                intensity = 'low' if isinstance(val,(int,float)) and val <=100 else ('mid' if isinstance(val,(int,float)) and val<=1000 else 'high')
                cells.append('<span class="activity '+intensity+'">'+esc(val)+'</span>')
            rows.append(cells)
        sections['matrix']=table(['Cell model genotype',*matrix['drugs']],rows,'matrix')+'<p class="caption">'+esc(matrix['endpoint'])+' · '+esc(matrix['units'])+' · lower values indicate greater activity in this assay. '+refs([matrix['source_id']])+'<br>'+esc(matrix['note'])+'</p>'
    else:
        sections['matrix']='<div class="empty">No genotype activity matrix supported by evidence available at this cutoff.</div>'
    def _status(p):
        raw=(p.get('status') or 'approved_or_active').replace('_',' ')
        return esc(raw)
    def _outcome(p):
        why=p.get('why_stopped')
        if why:
            cls=esc((p.get('failure_class') or 'setback').replace('_',' '))
            return '<strong>Stopped / limited:</strong> '+esc(why)+' <em>('+cls+')</em>'
        return '<span class="muted">—</span>'
    sections['programs']=table(['Compound','Names / identifiers','Status','Why it stopped / what limited it','Evidence-specific interpretation'],[
        [esc(p['drug']).title(),esc(', '.join(p['aliases'])),_status(p),_outcome(p),
         esc(p['role'])+' '+refs(p['evidence'])] for p in programs])
    name_rows=[]
    for name in report.get('names',[]):
        records=name.get('records',[])
        name_rows.append([esc(name['query']),esc(name['status']),esc(', '.join(str(r.get('unii') or r.get('uuid')) for r in records))])
    sections['names']=table(['Queried name','NCATS resolution','UNII / record'],name_rows) if name_rows else '<div class="empty">NCATS resolution not retrieved in this run.</div>'
    trials = report.get('trials') or {}
    stopped=[r for r in trials.get('studies',[]) if r.get('why_stopped')]
    sections['trials']=table(['Trial / phase','Sponsor / registry status','Recorded reason','Triage category'],[
        [external(r['url'],r['nct_id'])+'<small class="sub">'+esc(', '.join(r.get('phase',[])))+'</small>',esc(r.get('sponsor'))+'<small class="sub">'+esc(r.get('status'))+'</small>',esc(r['why_stopped']),'<span class="tag">'+esc(r.get('stop_reason_category','requires_review').replace('_',' '))+'</span>'] for r in stopped]) if stopped else '<div class="empty">No stopped-trial reasons retrieved for this view.</div>'
    sections['trial_count']=str(trials.get('returned',0))
    sections['rule_rows']=''.join(
        '<article class="rule" data-layer="'+r['layer']+'" data-tier="'+('human' if r['measurable_by'] is None else ('hard' if r['hard_filter'] else 'soft'))+'"><div class="rule-top"><span class="mono">'+esc(r['id'])+'</span><span class="tag '+('amber' if r['hard_filter'] else '')+'">'+('needs lab data' if r['measurable_by'] is None else ('must pass' if r['hard_filter'] else 'scored flag'))+'</span></div><h3>'+esc(r['criterion'])+'</h3><p>'+esc(r['policy_rationale'])+'</p><dl><dt>Metric</dt><dd>'+esc(r['metric'])+('</dd><dt>Threshold</dt><dd>'+esc(('≥ ' if r['direction']=='maximize' else '≤ ')+str(r['threshold'])+' '+r['units']) if r['threshold'] is not None else '</dd><dt>Threshold</dt><dd>Not computable yet')+'</dd><dt>Measure with</dt><dd>'+esc(r['measurable_by'] or 'Lab measurement')+'</dd></dl><div class="rule-foot">'+esc(r['layer'])+' · '+refs(r['evidence'])+'</div></article>' for r in rubric['criteria'])
    sections['overrides']=(''.join('<p>'+esc(o['replaced'])+' → '+esc(o['replacement'])+': '+esc(o['reason'])+' '+refs(o['evidence'])+'</p>' for o in rubric['overrides']) or '<p>No numeric threshold override is activated in this version. The engine supports cited, explicit overrides; no evidence-backed override was invented for the demo.</p>')
    pkpd = report.get('pkpd',[])
    sections['pkpd']=table(['Compound / endpoint','Observed value','Dose, population & schedule','Context / source'],[
        [esc(r['compound'])+'<small class="sub">'+esc(r['endpoint'].replace('_',' '))+'</small>',esc(r['value'])+' '+esc(r['units']),esc(r['dose'])+'<small class="sub">'+esc(r['population'])+' · '+esc(r['schedule'])+'</small>',esc(r.get('coadministration'))+'<small class="sub">'+esc(r.get('summary_statistic'))+' · '+esc(r['matrix'])+' · '+refs([r['source_id']])+'</small>'] for r in pkpd]) if pkpd else '<div class="empty">No dose- and population-qualified PK/PD rows are available in this view.</div>'
    endpoints=report['admet_endpoints']
    wanted={'Solubility_AqSolDB','Caco2_Wang','PPBR_AZ','VDss_Lombardo','Half_Life_Obach','Clearance_Hepatocyte_AZ','Clearance_Microsome_AZ','CYP3A4_Veith','hERG'}
    sections['admet']=table(['Predicted endpoint','Output / units','Interpretation'],[
        [esc(e['name']),'<code>'+esc(e['id'])+'</code><small class="sub">'+esc(e['units'])+'</small>',
         ('<span class="tag amber">weak validation in model metadata</span>' if e['id'] in {'Half_Life_Obach','VDss_Lombardo'} else 'Endpoint estimate; verify applicability')]
        for e in endpoints if e['id'] in wanted])
    screen=report.get('screen',{})
    estimate=screen.get('plan',{}).get('estimates',[{}])[0] if screen.get('plan',{}).get('estimates') else {}
    proteins=screen.get('plan',{}).get('proteins',[])
    coverage=proteins[0].get('coverage',{}) if proteins else {}
    status=screen.get('status','not_submitted')
    sections['screen_status']=esc(status.replace('_',' ').upper())
    sections['screen_detail']=esc(screen.get('message','Catalog KIT screen prepared. Custom mutant sequences require a different backend.'))
    sections['screen_cost']=esc(estimate.get('cost_usd','—'))
    sections['coverage']=esc(f"KIT length {coverage.get('sequence_length','?')} residues; scored {coverage.get('residue_start','?')}–{coverage.get('residue_end','?')}; training maximum {coverage.get('training_max_residues','?')}.")
    sections['hits']=table(['Rank','Compound','Predicted engagement','Model'],[
        [esc(h.get('rank')),esc(h.get('name') or h.get('compound_id')),esc(h.get('engagement')),esc(screen.get('model_version','see screen metadata'))] for h in screen.get('hits',[])[:25]]) if screen.get('hits') else '<div class="empty">No screen results are included yet. No simulated hits or predictions are shown.</div>'
    scores=report.get('scores',[])
    sections['scores']=table(['Compound','Score / data coverage'],[
        [esc(s['name']),esc(s['soft_score'])+' / '+esc(s['soft_coverage'])+'%'] for s in scores]) if scores else '<div class="empty">No candidate measurements have been scored.</div>'
    sections['discovery']=''.join('<li>'+external(r['url'],r['title'])+'<small class="sub">'+esc(r.get('published_at','date unavailable'))+'</small></li>' for r in (report.get('keenable') or {}).get('results',[]) if 'gist' in r.get('title','').lower() or 'stromal' in r.get('title','').lower())
    sections['sources']=''.join('<article class="source" id="'+esc(e['id'])+'"><div class="source-id">'+esc(e['id'])+'</div><div><h3>'+external(e['url'],e['title'])+'</h3><p>'+esc(e['finding'])+'</p><small>'+esc(e.get('published_on') or 'Publication date not assigned')+' · '+esc(e['evidence_type'])+' · '+esc(e.get('retrieval',''))+'</small></div></article>' for e in evidence)
    sections['integrations']=''.join('<div class="integration"><strong>'+esc(i['name'])+'</strong><span class="tag '+('green' if i['status']=='live' else 'amber')+'">'+esc(i['status'])+'</span><p>'+esc(i['detail'])+'</p></div>' for i in report['integrations'])
    sections['scope_notes']=''.join('<li>'+esc(note)+'</li>' for note in bundle['scope_notes'])
    sections['source_count']=str(len(evidence))
    sections['rule_count']=str(len(rubric['criteria']))
    sections['mutation_count']=str(len(mutations))
    sections['date_label']=esc('Evidence through '+rubric['as_of'] if rubric['as_of'] else 'Current evidence view · '+report['report_date'])
    sections['historical_note']=esc('Historical mode: current registry status, live discovery, modern controls and tool snapshots are excluded. Publication dates are checked, but this is not a reconstruction of the historical search index.' if rubric['as_of'] else 'Sources and policy are versioned. Use the CLI --as-of option for a publication-date cutoff.')
    sections['payload']=json.dumps({'rubric':rubric,'screen':screen},ensure_ascii=False,allow_nan=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
    template=(Path(__file__).parent/'templates/report.html').read_text(encoding='utf-8')
    for key,value in sections.items():
        template=template.replace('{{'+key+'}}',value)
    destination=Path(destination)
    destination.parent.mkdir(exist_ok=True,parents=True)
    destination.write_text(template,encoding='utf-8')
