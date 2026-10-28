// node tools/name_filter_test.js   (checks M.nameBlocked in money/ui.js: names that must be refused and names that must pass)
const fs=require('fs');const src=fs.readFileSync(__dirname+'/../money/ui.js','utf8').split('\n');
const s=src.findIndex(l=>l.startsWith('M.nameBlocked='));let e=s;while(!/return false;\};\s*$/.test(src[e]))e++;
const M={};eval(src.slice(s,e+1).join('\n'));
const Z='​';
const block=['Hardik','HARDIK','h4rdik','Hardhik','Hard1k','H a r d i k','H.a.r.d.i.k','h_a_r_d_i_k','Hardikk','Hardeek','Hardik Infra','Mr Hardik',
 'Aaradhy','aaradhy','Aaradhya','Aradhya','Aradhi','Aradhy','Aaradhi','A a r a d h y','Aaaradhy','Aradya','Arahdy','Aaradhyaa','4aradhy',
 'Fiona','FIONA','F1ona','Phiona','Fyona','Feona','Fionna','Fiyana','Fiyanna','Fiana','Fyana','Phiyana','Fi ona','F.i.o.n.a','Fiyaana','F10na',
 'Joshi','joshi','Joshy','J0shi','Joshee','Jooshi','J o s h i','Sonu','S0nu','Sonuu','Soonu','Sonoo','S.o.n.u','Sonu Joshi','Fiona Joshi',
 'Manoj','MANOJ','Man0j','Manooj','M a n o j','Manoz'.replace('z','j'),'Manoi','Latisha','Latesha','Letisha','Latishaa','L4tisha','Latisa','Lat1sha','Laatisha',
 'Dalit','dalit','D4lit','D a l i t','Daalit','Dalitt','Dalyt','Dalet','Dalid','Dal!t','Dal1t',
 'Patel','PATEL','P4tel','Pateliya','Patell','Mr Patel','Pat3l','Red Joy','Redjoy','R3djoy','Red-Joy','Redjoi','Jani','J a n i','Jani Infra','Saras','Khakhra','Khakra',
 'Hаrdik','Ηardik','Ｈａｒｄｉｋ','Jоshi','Sоnu','Mаnoj','Fіona','Dаlit',
 'H'+Z+'ardik','So'+Z+'nu','Jo­shi','Fi‍ona','Hardık','Hárdík','Sönü','Jóshí','kidrah','anoif','ihsoj',
 'हार्दिक','जोशी','सोनू','पटेल','मनोज','दलित','લતીશા','આરાધ્ય','પટેલ','जोशी जी','Mr. सोनू'];
const pass=['Janice','Janine','Meera Rao','Zero Mile Infra','Nagpur Holdings','Rahul Mehta','Sonia','Josh','Josephine','Fiat Motors','Harry','Red Fort Infra','Joy Builders','Priya Nair','Fina Corp','Aarav Shah','Ananya Iyer','Kabir Sethna','Tanvi Kulkarni','Shirish Bhonsle','Rajeshwari Natarajan','Asha Rao','Meridian Infra','Vikram Sarabhai','Dalton Group','Mohan Lal','Rohan Mehta','Neha Gupta','Karan Malhotra','Ishaan Verma','Aditi Rao','Arjun Reddy','Tara Singh','Lata Mangeshkar','Leela Group','Kavya Menon'];
let bad=0;for(const n of block)if(!M.nameBlocked(n)){bad++;console.log('NOT BLOCKED (should be):',JSON.stringify(n))}
for(const n of pass)if(M.nameBlocked(n)){bad++;console.log('BLOCKED (should pass):',JSON.stringify(n))}
console.log(bad?bad+' problems':'all '+(block.length+pass.length)+' checks ok');process.exit(bad?1:0);
