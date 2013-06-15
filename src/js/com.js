'use strict'

var WebSocketConnection = function(link,ws){
    var that = this;
    var reader = new FileReader;

    that.__super__(link);

    that.send_msg = function(data){
        ws.send(new Blob([data],{'type':'application/octet-stream'}))
    };
    that.start_recv = function(recv_callback){
        ws.onmessage = function(e){
            reader.onload = function(e){
                recv_callback(that,e.target.result);
            };
            reader.readAsText(e.data);
        }
    };

    ws.onclose = function(e){
        console.log('close');
        that.close();
    };
};__extend__(WebSocketConnection,imc.Connection);

var vus = new function(){
    var that = this;

    that.node = function(name){
        var that = this;
        that.name = name;
        that.parent = null;
        that.ref_count = 1;
        that.child = new Object;
        that.delay_child = new Object;

        that.url_chg = function(direct,url_upart,url_dpart){
            return 'cont';
        };
        that.get = function(){
            that.ref_count++;
        };
        that.child_set = function(node){
            var delay_obj;

            node.parent = that;
            that.child[node.name] = node;

            if(node.name in that.delay_child){
                delay_obj = that.delay_child[node.name];
                delete that.delay_child[node.name]; 
                delay_obj.defer.resolve();
            }
        };
        that.child_delayset = function(name){
            that.delay_child[name] = {
                'defer':$.Deferred()
            };
        };
        that.child_del = function(node){
            node.parent = null;
            delete that.child[node.name];

        };
        that.lookup = function(url,close_flag){
            var i;
            var url_part;
            var node_curr;
            var node_prev;

            url_part = url.match(/\/toj\/(.*)/)[1].split('/');
            url_part.pop();
            node_prev = null;
            node_curr = that;
            for(i = 0;i < url_part.length;i++){
                node_prev = node_curr;
                if((node_curr = node_curr.child[url_part[i]]) == undefined){
                    if(close_flag == true){
                        return node_prev;
                    }else{
                        return null;
                    }
                }
            }
            return node_curr;
        }
    };
};

var com = new function(){
    var that = this;
    var urlchg_reen = false;
    var urlchg_hasnext = false;
    var check_mbox_url = function(url){
        if(url.search(/toj\/m\/.*/) != -1){
return true;
        }else{
            return false;
        }
    }

    that.url_curr = null;
    that.url_prev = null;
    that.url_back = null;
    that.url_pbox = null;

    that.link = null;
    that.idendesc = null;
    that.backend_link = null;

    that.ready = function(){
        var i;
        var url;
        var urlpart;

        that.vus_root = new vus.node(null);
        that.vus_mbox = new vus.node('m');

        that.vus_mbox.url_chg = function(direct,url_upart,url_dpart){
            if(direct == 'in'){
                index.mask_show();
            }else if(direct == 'out'){
                index.mask_hide();
            }

            return 'cont';
        };
        that.vus_root.child_set(that.vus_mbox);

        urlpart = location.href.split('?');
        if(urlpart[0].search(/\/$/) == -1){
            url = urlpart[0] + '/';
            if(urlpart.length > 1){
                url = url + '?';
                for(i = 1;i < urlpart.length;i++){
                    url = url + urlpart[i];
                }
            }
            window.history.replaceState(null,document.title,url);
        }

        $(document).on('click','a',function(e){
            that.url_push($(this).attr('href'));   
            return false;
        });
    };

    that.url_push = function(url){
        if(url == location.href){
            return;
        }

        that.url_prev = location.href;
        that.url_back = that.url_prev;
        window.history.pushState(null,document.title,url);   
        that.url_chg();
    };
    that.url_push_back = function(block_regexp){
        if(that.url_back == null || that.url_back.search(block_regexp) != -1){
            that.url_push('/toj/home/');
        }else{
            that.url_push(that.url_back);
        }
    };
    that.url_update = function(url){
        if(url == location.href){
            return;
        }

        that.url_prev = location.href;
        window.history.replaceState(null,document.title,url);   
        that.url_chg();
    };
    that.url_pull_pbox = function(){
        that.url_update(that.url_pbox);
        //window.history.back();
        //    
    };
    that.url_chg = function(){
        var i;
        var ret;
        var part;
        var stop_flag;

        var url_old;
        var url_new;
        var url_cpart;	
        var param_cpart;
        var url_ppart;
        var param_ppart;
        var is_mbox_old;
        var is_mbox_new;

        var part;
        var node_name;
        var node_param;
        var url_upart;
        var url_dpart;
        var node_curr;
        var node_parent;
        var node_bottom;

        var _chg_out = function(url_ppart,param_ppart,url_cpart){
            var i;
            var len;

            var node_name;
            var url_upart;
            var url_dpart;
            var node_curr;
            var node_parent;
            var node_bottom;

            len = Math.min(url_ppart.length,url_cpart.length);    
            node_bottom = that.vus_root;
            node_curr = node_bottom;
            for(i = 0;i < len;i++){
                if(url_ppart[i] != url_cpart[i]){
                    break;
                }

                node_name = url_ppart[i];
                if((node_curr = node_curr.child[node_name]) == undefined){
                    break;
                }
                node_bottom = node_curr;
            }
            if(node_curr != undefined){
                for(;i < url_ppart.length;i++){
                    node_name = url_ppart[i];
                    if(node_curr.child[node_name] == undefined){
                        break;
                    }
                    node_curr = node_curr.child[node_name];
                }

                i--;
                url_upart = url_ppart.slice(0);
                url_dpart = new Array;
                while(node_curr && node_curr != node_bottom){
                    node_parent = node_curr.parent;
                    node_curr.url_chg('out',url_upart,url_dpart,param_ppart[i]);

                    url_dpart = url_dpart.splice(0,0,url_upart.pop());
                    node_curr = node_parent;
                    i--;
                }
            }

            return node_bottom;
        };
        var _chg_in = function(url_cpart,param_cpart,idx,node_curr,url_upart,url_dpart){
            var node_name;
            var node_param;
            var node_parent;
            var delay_obj;

            for(;idx < url_cpart.length;idx++){
                node_parent = node_curr;

                node_name = url_cpart[idx];
                node_param = param_cpart[idx];

                if((node_curr = node_parent.child[node_name]) == undefined){
                    if((delay_obj = node_parent.delay_child[node_name]) == undefined){
                        that.url_update('/toj/none/');
                    }else{
                        delay_obj.url_curr = url_new; 
                        delay_obj.defer.done(function(){
                            if(url_new == delay_obj.url_curr){
                                _chg_in(url_cpart,param_cpart,idx,node_parent,url_upart,url_dpart);
                            }
                        });
                    }
                    break;
                }
                url_upart.push(url_dpart.shift());

                ret = node_curr.url_chg('in',url_upart,url_dpart,node_param);
                if(ret == 'stop'){
                    break;
                }
            }
        };

        that.url_curr = location.href;
        console.log(that.url_curr);

        if(urlchg_reen == true){
            urlchg_hasnext = true;
            return;
        }else{
            urlchg_reen = true;
            urlchg_hasnext = true;
        }

        while(urlchg_hasnext){
            urlchg_hasnext = false;

            url_old = that.url_prev;
            url_new = that.url_curr;

            url_cpart = url_new.match(/toj\/(.*)/)[1].split('/');
            url_cpart.pop();
            if(url_cpart.length == 0){
                that.url_update('/toj/home/');
                continue;
            }

            param_cpart = new Array;
            for(i = 0;i < url_cpart.length;i++){
                part = url_cpart[i].split(':');
                url_cpart[i] = part[0];
                if(part.length > 1){
                    part.splice(0,1);
                    param_cpart.push(part);
                }else{
                    param_cpart.push(null);
                }
            }

            if(url_old == null){
                is_mbox_old = false;
            }else{
                is_mbox_old = check_mbox_url(url_old);
            }
            is_mbox_new = check_mbox_url(url_new);

            if(url_old == null || (is_mbox_old == false && is_mbox_new == true)){
                node_bottom = that.vus_root;
            }else if(that.url_pbox != null && is_mbox_old == true && is_mbox_new == false){
                url_ppart = that.url_pbox.match(/toj\/(.*)/)[1].split('/');
                url_ppart.pop();

                param_ppart = new Array;
                for(i = 0;i < url_ppart.length;i++){
                    part = url_ppart[i].split(':');
                    url_ppart[i] = part[0];
                    if(part.length > 1){
                        part.splice(0,1);
                        param_ppart.push(part);
                    }else{
                        param_ppart.push(null);
                    }
                }

                node_bottom = _chg_out(url_ppart,param_ppart,url_cpart);	
            }else{
                url_ppart = url_old.match(/toj\/(.*)/)[1].split('/');
                url_ppart.pop();

                param_ppart = new Array;
                for(i = 0;i < url_ppart.length;i++){
                    part = url_ppart[i].split(':');
                    url_ppart[i] = part[0];
                    if(part.length > 1){
                        part.splice(0,1);
                        param_ppart.push(part);
                    }else{
                        param_ppart.push(null);
                    }
                }

                node_bottom = _chg_out(url_ppart,param_ppart,url_cpart);	
            }

            if(url_new != that.url_pbox){
                i = 0;
                node_curr = that.vus_root;
                url_upart = new Array;
                url_dpart = url_cpart.slice(0);
                stop_flag = false;
                while(node_curr != node_bottom){
                    node_name = url_cpart[i];
                    node_param = param_cpart[i];

                    if((node_curr = node_curr.child[node_name]) == undefined){
                        break;
                    }
                    url_upart.push(url_dpart.shift());
                    ret = node_curr.url_chg('same',url_upart,url_dpart,node_param);
                    if(ret == 'stop'){
                        stop_flag = true;
                        break;
                    }
                    i++;
                }
                if(stop_flag == false){
                    _chg_in(url_cpart,param_cpart,i,node_curr,url_upart,url_dpart);	
                }
            }

            if(that.url_pbox != null && is_mbox_old == true && is_mbox_new == false){
                url_ppart = url_old.match(/toj\/(.*)/)[1].split('/');
                url_ppart.pop();
                _chg_out(url_ppart,param_ppart,url_cpart);
            }

            if(is_mbox_new == false){
                if(that.url_pbox == null){
                    $('#index_mask').removeClass('index_mask_nopbox');
                    $('#index_mask').addClass('index_mask');
                }
                that.url_pbox = url_new;
            }
        }

        urlchg_reen = false;
    };

    that.loadpage = function(htmlurl,callback){
        var j_index_page = $('#index_page');
        var defer = $.Deferred();

        j_index_page.empty();
        j_index_page.load(htmlurl,function(data,stat,xhr){
            defer.resolve();
        });

        return defer.promise();
    };
    that.exheight = function(){
        var i;
        var es = $('[exheight="true"]');
        var j_e;
        var winheight = $(window).innerHeight();
        var extop;

        for(i = 0;i < es.length;i++){
            j_e = $(es[i]);

            if((extop = j_e.attr('extop')) == undefined){
                extop = j_e.css('top');
            }
            extop = extop.match('(.*)px')[1];
            j_e.height(winheight - extop);
        }
    }

    that.conn_backend = function(){
        $.post('http://toj.tfcis.org:83/conn',{},function(res){
            var reto;
            var iden;
            var ws;

            if(res[0] != 'E'){
                reto = JSON.parse(res)

                that.link = reto.client_link;
                that.idendesc = reto.client_idendesc;
                that.backend_link = reto.backend_link;

                ws = new WebSocket('ws://' + reto.ip + ':' + reto.port + '/conn');
                ws.onopen = function(){
                    var i;
                    var conn;

                    console.log('open');

                    ws.send(JSON.stringify({
                        'client_link':that.link
                    }));

                    conn = new WebSocketConnection(reto.backend_link,ws);

                    new imc.Auth();
                    new imc.Proxy(that.link,imc.Auth.instance,function(link,callback){
                        callback(conn);
                    });
                    imc.Proxy.instance.add_conn(conn);

                    imc.Auth.change_current_iden(that.idendesc)
                };
            }else{
                setTimeout(conn_backend,5000);
            }
        });
    }
};


