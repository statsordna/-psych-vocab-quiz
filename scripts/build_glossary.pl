#!/usr/bin/perl
use strict; use warnings; use utf8;
binmode(STDOUT, ':encoding(UTF-8)');

sub decode_ents {
    my ($s) = @_;
    $s =~ s/&#(\d+);/chr($1)/ge;
    $s =~ s/&amp;/&/g; $s =~ s/&lt;/</g; $s =~ s/&gt;/>/g;
    return $s;
}
sub json_esc {
    my ($s) = @_;
    $s =~ s/\\/\\\\/g; $s =~ s/"/\\"/g; $s =~ s/\n/\\n/g; $s =~ s/\r//g;
    return $s;
}

# order matters: later overrides earlier (v24 -> v25 -> v26)
my @dirs = @ARGV;
my %glossary; # key: lowercased english term -> record
my @order;

for my $dir (@dirs) {
    for my $sheetnum (1,2) {
        my $section = $sheetnum == 1 ? '일반 전공 용어' : '관심사 관련 용어';
        my $f = "$dir/xl/worksheets/sheet$sheetnum.xml";
        open(my $fh, '<:raw', $f) or next;
        local $/; my $xml = <$fh>; close $fh;
        my @rows;
        while ($xml =~ /<row r="(\d+)"[^>]*>(.*?)<\/row>/gs) {
            my ($rownum, $rowcontent) = ($1, $2);
            next if $rownum == 1; # header
            my %cell;
            while ($rowcontent =~ /<c r="([A-Z]+)\d+"[^>]*>(.*?)<\/c>/gs) {
                my ($col, $cellcontent) = ($1, $2);
                my $val = '';
                if ($cellcontent =~ /<is><t[^>]*>(.*?)<\/t><\/is>/s) { $val = decode_ents($1); }
                elsif ($cellcontent =~ /<t[^>]*>(.*?)<\/t>/s) { $val = decode_ents($1); }
                $cell{$col} = $val;
            }
            push @rows, \%cell;
        }
        for my $r (@rows) {
            my ($category, $en, $kr, $def, $link, $star, $trend);
            if ($sheetnum == 1) {
                ($category, $en, $kr, $def, $link, $star, $trend) =
                    ($r->{A}, $r->{C}, $r->{D}, $r->{E}, $r->{F}, $r->{G}, $r->{H});
            } else {
                ($category, $en, $kr, $def, $link, $star, $trend) =
                    ($r->{A}, $r->{B}, $r->{C}, $r->{D}, $r->{E}, $r->{F}, $r->{G});
            }
            next unless $en && $en =~ /\S/;
            if ($category) {
                $category =~ s/\s+/ /g;
                $category =~ s/\s*\([^)]*\)\s*$//;
            }
            $en =~ s/^\s+|\s+$//g;
            my $key = lc($en);
            unless (exists $glossary{$key}) { push @order, $key; }
            $glossary{$key} = {
                en => $en, kr => $kr, def => $def, link => $link,
                star => ($star && $star =~ /\S/) ? 1 : 0,
                trend => ($trend && $trend =~ /\S/) ? 1 : 0,
                category => $category, section => $section,
            };
        }
    }
}

print "[\n";
my $first = 1;
for my $key (@order) {
    my $g = $glossary{$key};
    print ",\n" unless $first; $first = 0;
    print "  {";
    print qq("en":"@{[json_esc($g->{en})]}",);
    print qq("kr":"@{[json_esc($g->{kr})]}",);
    print qq("def":"@{[json_esc($g->{def})]}",);
    print qq("link":"@{[json_esc($g->{link})]}",);
    print qq("category":"@{[json_esc($g->{category})]}",);
    print qq("section":"@{[json_esc($g->{section})]}",);
    print qq("star":$g->{star},);
    print qq("trend":$g->{trend});
    print "}";
}
print "\n]\n";
