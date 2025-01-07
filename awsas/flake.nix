{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = {nixpkgs, ...}: let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};
    deps = [
      pkgs.jq
      pkgs.awscli2
    ];
  in {
    packages.${system}.default = pkgs.stdenv.mkDerivation rec {
      name = "awsas";
      src = ./.;
      nativeBuildInputs = [pkgs.makeWrapper];
      buildCommand = ''
        mkdir -p $out/bin/

        cp -ai $src/${name}.sh $out/bin/${name}
        wrapProgram $out/bin/${name} --prefix PATH : ${pkgs.lib.makeBinPath deps}

        comp_dest=$out/share/zsh/site-functions
        mkdir -p $comp_dest
        cat << 'EOF' > $comp_dest/_awsas
        #compdef awsas

        _awsas() {
          local -a args _comp_priv_prefix

          args=(
            "(-)1: :{ _values $(aws configure list-profiles | tr '\n' ' ') }"
            '*:: :{ _comp_priv_prefix=( aws ); words=(aws $words[2,-1]); _normal }'
          )

          _arguments -s -S $args
        }
        compdef _awsas awsas
        EOF
        chmod 755 $comp_dest/_awsas
      '';
    };
  };
}
