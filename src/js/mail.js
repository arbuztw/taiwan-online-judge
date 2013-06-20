var mail = new function(){
    var that = this;
    var j_index_page;
    var j_maillist;
    var j_newmail;
    var j_readmail;
    var j_tabnav_inbox;
    var j_tabnav_backup;

    var readmail_mailid = null;
    var maillist_type = null;
    var maillist_off = null;

    function mailitem_set(j_item,mailid,username,title,time,unread){
        var j_span;

        j_item.find('td.username').text(username);
        j_item.find('td.title').text(title);
        j_item.find('td.time').text(time);

        j_span = j_item.find('span.check');
        j_span.check(false);
        j_span.attr('mailid',mailid);

        if(unread == true){
            j_item.addClass('warning');
        }else{
            j_item.removeClass('warning');
        }
        
        j_item.off('click').on('click',function(e){
            var j_e = $(e.target);
            if(j_e.is('td.check')){
                j_e.find('span.check').click();
                return;
            }
            if(j_e.parents('td.check').length > 0){
                return;
            }

            readmail_mailid = mailid;
            j_readmail.modal('show'); 
            return false;
        });
    };
    function mailitem_create(mailid,username,title,time,unread){
        var j_item = $('<tr class="item"><td class="check"><span class="check" data-label="mailcheck"></span></td><td class="username"></td><td class="title"></td><td class="time"></td></tr>');

        mailitem_set(j_item,mailid,username,title,time,unread);

        return j_item;
    };
    function update_maillist(){
        j_index_page.find('span.checkall').check(false);

        com.call_backend('core/mail/','list_mail',function(result){
            var data;
            var mail;
            var items;
            var j_item;
            var i;

            if(com.is_callerr(result)){
                //TODO GE
            }else{
                data = result.data; 

                items = j_maillist.find('tr.item');
                for(i = 0;i < Math.min(items.length,data.length);i++){
                    mail = data[i];

                    mailitem_set($(items[i]),mail.mailid,mail.from_username,mail.title,com.get_timestring(mail.send_time),mail.unread);
                }
                for(;i < data.length;i++){
                    mail = data[i];

                    j_item = mailitem_create(mail.mailid,mail.from_username,mail.title,com.get_timestring(mail.send_time),mail.unread);
                    j_maillist.append(j_item);
                }
                for(;i < items.length;i++){
                    $(items[i]).remove();
                }
            }
        },maillist_type,maillist_off,maillist_off + 20);
    };

    that.ready = function(){
        var mail_node = new vus.node('mail');
        var inbox_node = new vus.node('inbox');
        var backup_node = new vus.node('backup');

        j_index_page = $('#index_page');

        mail_node.url_chg = function(direct,url_upart,url_dpart,param){
            if(direct == 'in'){
                index.set_menu('信箱');
                index.set_title('');

                index.clear_tabnav();
                
                mail_node.child_delayset('inbox');
                mail_node.child_delayset('backup');

                com.loadpage('/toj/html/mail.html').done(function(){
                    var newmail_content;
                    var readmail_content;

                    j_maillist = j_index_page.find('table.maillist > tbody');
                    j_newmail = j_index_page.find('div.newmail');
                    j_readmail = j_index_page.find('div.readmail');
                    newmail_content = com.create_codebox(j_newmail.find('div.content'),'text/html');
                    readmail_content = com.create_codebox(j_readmail.find('div.content'),'text/html',true);

                    j_tabnav_inbox = index.add_tabnav('收件匣','/toj/mail/inbox/');
                    j_tabnav_backup = index.add_tabnav('寄件備份','/toj/mail/backup/');

                    j_index_page.find('button.newmail').on('click',function(e){
                        j_newmail.modal('show');
                    });
                    j_index_page.find('button.delmail').on('click',function(e){
                        var i;
                        var mails;
                        var count = 0;
                        var fail = 0;

                        mails = j_maillist.find('span.check[checked="checked"]');
                        count = mails.length;
                        for(i = 0;i < mails.length;i++){
                            com.call_backend('core/mail/','del_mail',function(result){
                                console.log(result);
                                if(com.is_callerr(result)){
                                    fail++;
                                }

                                count--;
                                if(count == 0){
                                    if(fail == 0){
                                        index.add_alert('alert-success','成功','郵件已刪除',true);
                                    }else{
                                        index.add_alert('alert-error','失敗',fail + '封郵件刪除失敗',true);
                                    }

                                    update_maillist();
                                }
                            },parseInt($(mails[i]).attr('mailid')));
                        }
                    });

                    j_newmail.on('shown',function(e){
                        newmail_content.refresh();
                    });
                    j_newmail.on('hide',function(e){
                        j_newmail.find('input').val('');
                        newmail_content.setValue('');

                        update_maillist();
                    });
                    j_newmail.find('button.submit').on('click',function(e){
                        var to_username = j_newmail.find('input.to_username').val();
                        var title = j_newmail.find('input.title').val();
                        var content = newmail_content.getValue();

                        com.call_backend('core/mail/','send_mail',function(result){
                            var data = result.data;
                            var errmsg;

                            if(com.is_callerr(result)){
                                if(data == 'Etitle_too_short'){
                                    errmsg = '郵件標題過短';
                                }else if(data == 'Etitle_too_long'){
                                    errmsg = '郵件標題過長';
                                }else if(data == 'Econtent_too_short'){
                                    errmsg = '郵件內容過短';
                                }else if(data == 'Econtent_too_long'){
                                    errmsg = '郵件內容過長';
                                }else if(data == 'Eto_username'){
                                    errmsg = '收件人不存在';
                                }else{
                                    errmsg = '信件寄出時發生錯誤';
                                }

                                index.add_alert('alert-error','失敗',errmsg,true);
                            }else{
                                index.add_alert('alert-success','成功','信件已寄出',true);
                                j_newmail.modal('hide');
                            }
                        },to_username,title,content);
                    });
                    j_newmail.find('button.cancel').on('click',function(e){
                        j_newmail.modal('hide');
                    });

                    j_readmail.on('show',function(e){
                        com.call_backend('core/mail/','recv_mail',function(result){
                            var data;

                            if(com.is_callerr(result)){
                                //TODO GE
                            }else{
                                data = result.data;

                                j_readmail.find('h3.title').text(data.title);
                                j_readmail.find('span.username').text(data.from_username);
                                readmail_content.setValue(data.content);
                            }
                        },readmail_mailid); 
                    });
                    j_readmail.on('shown',function(e){
                        readmail_content.refresh();
                    });
                    j_readmail.on('hide',function(e){
                        j_readmail.find('h3.title').text('');
                        j_readmail.find('span.from_username').text('');
                        readmail_content.setValue('');
                        
                        update_maillist();
                    });
                    j_readmail.find('button.reply').on('click',function(e){
                        j_newmail.find('input.to_username').val(j_readmail.find('span.username').text());
                        j_newmail.find('input.title').val('Re: ' + j_readmail.find('h3.title').text());

                        j_readmail.modal('hide');
                        j_newmail.modal('show');
                    });

                    mail_node.child_set(inbox_node);
                    mail_node.child_set(backup_node);
                });

                if(url_dpart.length == 0){
                    com.url_update('/toj/mail/inbox/');
                }
            }else if(direct == 'out'){
                mail_node.child_del(inbox_node);
                mail_node.child_del(backup_node);
            }

            return 'cont';
        };
        com.vus_root.child_set(mail_node);

        inbox_node.url_chg = function(direct,url_upart,url_dpart,param){
            if(direct == 'in' || direct == 'same'){
                maillist_type = 1;
                if(param == null){
                    maillist_off = 0;
                }else{
                    maillist_off = parseInt(param);
                }

                j_tabnav_inbox.active();
                j_index_page.find('table.maillist th.username').text('寄件人');
                j_readmail.find('span.username_label').text('寄件人');

                com.call_backend('core/mail/','get_mail_count',function(result){
                    var i;
                    var j_div = j_index_page.find('div.pagination');
                    var offs;
                    var as;

                    if(com.is_callerr(result)){
                        //TODO GE
                    }else{
                        offs = com.create_pagination(j_div,0,result.data.tot_count,maillist_off,20);
                        as = j_div.find('a');
                        for(i = 0;i < as.length;i++){
                            $(as[i]).attr('href','/toj/mail/inbox:' + offs[i] + '/');
                        }
                    }
                },maillist_type);

                update_maillist();
            }

            return 'cont';
        };

        backup_node.url_chg = function(direct,url_upart,url_dpart,param){
            if(direct == 'in' || direct == 'same'){
                maillist_type = 2;
                if(param == null){
                    maillist_off = 0;
                }else{
                    maillist_off = parseInt(param);
                }

                j_tabnav_backup.active();
                j_index_page.find('table.maillist th.username').text('收件人');
                j_readmail.find('span.username_label').text('收件人');

                com.call_backend('core/mail/','get_mail_count',function(result){
                    var i;
                    var j_div = j_index_page.find('div.pagination');
                    var offs;
                    var as;

                    if(com.is_callerr(result)){
                        //TODO GE
                    }else{
                        offs = com.create_pagination(j_div,0,result.data.tot_count,maillist_off,20);
                        as = j_div.find('a');
                        for(i = 0;i < as.length;i++){
                            $(as[i]).attr('href','/toj/mail/backup:' + offs[i] + '/');
                        }
                    }
                },maillist_type);

                update_maillist();
            }

            return 'cont';
        };
    };
};
